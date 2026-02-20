/**
 * download.js
 * 기능: 서버에서 변환된 결과물을 조회하고 갤러리 형태로 보여줌
 * 추가 기능: 서버 연결 실패 시 테스트 모드, 파일 상세 정보 테이블 출력
 */

import { API_endpoints } from './config.js';

const SERVER_BASE_URL = "https://moist-facete-penney.ngrok-free.dev";

const API_CONFIG = {
    HISTORY_DETAIL: (id) => `${SERVER_BASE_URL}/api/dicom/history/${id}`,
    DOWNLOAD: (id) => `${SERVER_BASE_URL}/api/dicom/download/${id}`
};

// ★ [테스트용] 서버가 꺼졌을 때 사용할 더미 이미지 데이터
const MOCK_IMAGES = [
    { name: "test_image_01.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+1" },
    { name: "test_image_02.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+2" },
    { name: "test_image_03.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+3" },
    { name: "test_image_04.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+4" },
    { name: "test_image_05.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+5" },
    { name: "test_image_06.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+6" },
    { name: "test_image_07.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+7" },
    { name: "test_image_08.png", url: "https://via.placeholder.com/400x400.png?text=DICOM+8" }
];

window.addEventListener('DOMContentLoaded', async () => {
    console.log("download.js: 화면 로드 완료, 로직 시작");

    // === DOM 요소 ===
    const fileNameElement = document.getElementById("result-file-name");
    const galleryContainer = document.getElementById("gallery-container");
    const explorerGrid = document.getElementById("explorer-grid-container");
    const statusIcon = document.getElementById("status-icon"); 
    
    const mainDownloadBtn = document.getElementById("main-download-btn");
    const expDownloadBtn = document.getElementById("exp-download-btn");
    const viewAllBtn = document.getElementById("view-all-btn");
    
    const mainSelectBtn = document.getElementById("main-select-toggle-btn");
    const mainDeselectBtn = document.getElementById("main-deselect-btn");
    const expSelectBtn = document.getElementById("exp-select-toggle-btn");
    const expDeselectBtn = document.getElementById("exp-deselect-btn");

    const imageModal = document.getElementById("image-modal");
    const modalImg = document.getElementById("modal-img");
    const modalCaption = document.getElementById("modal-caption");
    const closeImageModal = document.getElementById("close-image-modal");

    const explorerModal = document.getElementById("explorer-modal");
    const closeExplorerModal = document.getElementById("close-explorer-modal");

    // === 상태 변수 ===
    let isSelectionMode = false;
    const selectedFiles = new Set();
    let imagesData = []; 
    let serverFileName = "result";
    let originalFileBlob = null; 

    // URL 파라미터 확인
    const params = new URLSearchParams(window.location.search);
    const dicomId = params.get('id');

    // === 메인 실행부 ===
    try {
        if (!dicomId) throw new Error("ID 없음");
        await checkServerStatusAndLoad(dicomId);
    } catch (error) {
        console.warn("⚠️ 서버 연결 실패: 테스트 모드로 실행합니다.", error);
        startTestMode(dicomId || 'TEST-999');
    }

    // --- 테스트 모드 ---
    function startTestMode(id) {
        serverFileName = "TEST_RESULT.zip";
        if (fileNameElement) fileNameElement.textContent = "테스트 모드 (서버 미연결)";
        
        // 더미 이미지를 화면에 세팅
        imagesData = MOCK_IMAGES.map(img => ({
            ...img,
            originalBlob: new Blob(["test"], { type: "image/png" })
        }));
        
        // 테스트용 상세 정보 테이블 렌더링
        renderDetailInfo({
            id: id,
            patientName: "홍길동 (테스트)",
            modality: "CT",
            studyDate: "20260219",
            conversionStatus: "SUCCESS"
        });

        renderAll();
    }

    // =========================================================
    // 서버 통신 및 데이터 로딩
    // =========================================================

    async function checkServerStatusAndLoad(id) {
        const apiUrl = API_CONFIG.HISTORY_DETAIL(id);
        
        const statusRes = await fetch(apiUrl, {
            headers: { 'ngrok-skip-browser-warning': '69420' }
        });

        if (!statusRes.ok) throw new Error(`상태 조회 실패 (HTTP ${statusRes.status})`);
        
        const statusData = await statusRes.json();
        console.log("📦 [서버 원본 데이터]:", statusData); 

        // ★ [핵심] 가져온 정보로 하단 상세 정보 테이블 채우기
        renderDetailInfo(statusData);

        if (statusData.fileName) {
            serverFileName = statusData.fileName;
            if (fileNameElement) fileNameElement.textContent = serverFileName;
        }

        const status = statusData.status || statusData.conversionStatus;

        if (status === 'SUCCESS' || status === 'SUCESS') {
            updateLoadingMessage("파일을 다운로드하고 분석 중입니다...");
            await processDownload(id);
        } else if (status === 'FAIL' || status === 'FAILED') {
            throw new Error("서버에서 변환 실패 응답을 받았습니다.");
        } else if (status === 'PROCESSING' || status === 'PENDING') {
            handleProcessing(); 
        } else {
            throw new Error(`알 수 없는 변환 상태입니다: ${status}`);
        }
    }

    async function processDownload(id) {
        try {
            const downloadUrl = API_CONFIG.DOWNLOAD(id);
            const res = await fetch(downloadUrl, { headers: { 'ngrok-skip-browser-warning': '69420' } });
            if (!res.ok) throw new Error("파일 다운로드 실패");
            
            const contentType = res.headers.get("Content-Type");
            originalFileBlob = await res.blob(); 
            imagesData = []; 

            if (contentType && (contentType.includes("zip") || serverFileName.endsWith(".zip"))) {
                await unzipAndLoad(originalFileBlob); 
            } else {
                const url = URL.createObjectURL(originalFileBlob);
                imagesData.push({ name: serverFileName, url: url, originalBlob: originalFileBlob });
            }

            if (imagesData.length === 0) updateLoadingMessage("표시할 이미지가 없습니다.");
            else renderAll(); 

        } catch (err) {
            console.error("다운로드 오류:", err);
            throw err; 
        }
    }

    async function unzipAndLoad(zipBlob) {
        try {
            const zip = await JSZip.loadAsync(zipBlob);
            const promises = [];
            zip.forEach((relativePath, zipEntry) => {
                if (!zipEntry.dir && (zipEntry.name.match(/\.(png|jpe?g)$/i))) {
                    const promise = zipEntry.async('blob').then(blob => {
                        return { name: zipEntry.name, url: URL.createObjectURL(blob), originalBlob: blob };
                    });
                    promises.push(promise);
                }
            });
            imagesData = await Promise.all(promises);
            imagesData.sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            throw new Error("ZIP 압축 해제 실패: " + e.message);
        }
    }

    // =========================================================
    // ★ 파일 상세 정보 테이블 렌더링 함수
    // =========================================================
    function renderDetailInfo(data) {
        const detailCard = document.getElementById('detail-info-card');
        const tbody = document.getElementById('detail-table-body');
        
        if (!detailCard || !tbody) return;

        const id = data.id || '-';
        const patientName = data.patientName || data.patientId || '-';
        const modality = data.modality || '-';
        let studyDate = data.studyDate || '-';
        const status = data.conversionStatus || data.status || 'UNKNOWN';

        if (studyDate.length === 8) {
            studyDate = `${studyDate.substring(0, 4)}-${studyDate.substring(4, 6)}-${studyDate.substring(6, 8)}`;
        }

        let statusBadge = `<span class="badge-status" style="background:#f3f4f6; border:1px solid #d1d5db; color:#374151;">알수없음</span>`;
        if (status === 'SUCCESS' || status === 'SUCESS') {
            statusBadge = `<span class="badge-status badge-success">완료</span>`;
        } else if (status === 'PROCESSING' || status === 'PENDING') {
            statusBadge = `<span class="badge-status badge-processing">변환중</span>`;
        } else if (status === 'FAIL' || status === 'FAILED') {
            statusBadge = `<span class="badge-status badge-fail">실패</span>`;
        }

        tbody.innerHTML = `
            <tr>
                <td style="font-weight: bold;">#${id}</td>
                <td>${patientName}</td>
                <td><span class="badge-modality">${modality}</span></td>
                <td>${studyDate}</td>
                <td>${statusBadge}</td>
            </tr>
        `;

        detailCard.style.display = 'block';
    }

    // =========================================================
    // UI 렌더링 및 기능 연결
    // =========================================================

    function renderAll() {
        renderGallery(galleryContainer, imagesData); 
        renderGallery(explorerGrid, imagesData);     
        updateButtonsUI(); 
    }

    function renderGallery(container, images) {
        container.innerHTML = ''; 
        images.forEach(imgData => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `gallery-item ${isSelectionMode ? 'select-mode' : ''} ${selectedFiles.has(imgData.name) ? 'selected' : ''}`;
            
            const checkOverlay = document.createElement('div');
            checkOverlay.className = `check-overlay ${selectedFiles.has(imgData.name) ? 'checked' : ''}`;
            
            const img = document.createElement('img');
            img.src = imgData.url;
            img.className = 'gallery-thumb';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'gallery-item-name';
            nameSpan.textContent = imgData.name;

            const handleClick = (e) => {
                e.stopPropagation();
                if (isSelectionMode) toggleFileSelection(imgData.name); 
                else openImagePopup(imgData.url, imgData.name); 
            };

            img.onclick = handleClick;
            checkOverlay.onclick = (e) => { e.stopPropagation(); toggleFileSelection(imgData.name); };
            
            itemDiv.appendChild(checkOverlay);
            itemDiv.appendChild(img);
            itemDiv.appendChild(nameSpan);
            container.appendChild(itemDiv);
        });
    }

    function toggleSelectionMode() { isSelectionMode = !isSelectionMode; renderAll(); }
    function toggleFileSelection(fileName) { selectedFiles.has(fileName) ? selectedFiles.delete(fileName) : selectedFiles.add(fileName); renderAll(); }
    function deselectAll() { selectedFiles.clear(); renderAll(); }

    function updateButtonsUI() {
        const downloadText = isSelectionMode ? `선택된 ${selectedFiles.size}개 다운로드` : `⬇ 전체 파일 다운로드`;
        const selectText = isSelectionMode ? "선택 완료" : "선택하기";

        [mainDownloadBtn, expDownloadBtn].forEach(btn => {
            btn.textContent = downloadText;
            if (isSelectionMode) btn.classList.add('selected-mode'); 
            else btn.classList.remove('selected-mode');
            
            btn.onclick = isSelectionMode ? handleSelectedDownload : handleFullDownload;
        });

        [mainSelectBtn, expSelectBtn].forEach(btn => {
            btn.textContent = selectText;
            if (isSelectionMode) btn.classList.add('active'); else btn.classList.remove('active');
        });

        [mainDeselectBtn, expDeselectBtn].forEach(btn => {
            if (isSelectionMode) btn.classList.remove('hidden'); else btn.classList.add('hidden');
        });
    }

    function handleFullDownload(e) {
        e.preventDefault();
        if (!originalFileBlob) {
            alert(serverFileName === "TEST_RESULT.zip" ? "테스트 모드: 실제 파일은 다운로드할 수 없습니다." : "다운로드할 파일이 없습니다.");
            return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(originalFileBlob);
        a.download = serverFileName; 
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    async function handleSelectedDownload(e) {
        e.preventDefault();
        if (selectedFiles.size === 0) return alert("선택된 파일이 없습니다.");
        
        const zip = new JSZip();
        imagesData.forEach(img => { 
            if (selectedFiles.has(img.name)) zip.file(img.name, img.originalBlob); 
        });
        
        const content = await zip.generateAsync({type:"blob"});
        const a = document.createElement("a");
        a.href = URL.createObjectURL(content);
        const baseName = serverFileName.replace(/\.(zip|png|dcm)$/i, "");
        a.download = `selected_${baseName}.zip`; 
        document.body.appendChild(a); 
        a.click(); 
        document.body.removeChild(a);
    }

    function openImagePopup(url, name) { modalImg.src = url; modalCaption.textContent = name; imageModal.style.display = "block"; }
    function updateLoadingMessage(msg) { galleryContainer.innerHTML = `<div class="loading-msg">${msg}</div>`; explorerGrid.innerHTML = galleryContainer.innerHTML; }
    
    function handleError(msg) {
        if (statusIcon) statusIcon.src = "janjf93-false-2061132_1280.png";
        const errorHtml = `<div class="loading-msg" style="color:red; font-weight:bold;">❌ ${msg}</div>`;
        galleryContainer.innerHTML = errorHtml;
        explorerGrid.innerHTML = errorHtml;
        if (fileNameElement) fileNameElement.textContent = "접근 오류"; 
        mainDownloadBtn.style.display = "none";
    }

    function handleProcessing() {
        if (statusIcon) statusIcon.src = "loading_spinner.gif";
        updateLoadingMessage("변환 작업 중... 잠시만 기다려주세요.");
        setTimeout(() => checkServerStatusAndLoad(dicomId), 3000);
    }
    
    // 이벤트 리스너 등록
    mainSelectBtn.onclick = toggleSelectionMode;
    expSelectBtn.onclick = toggleSelectionMode;
    mainDeselectBtn.onclick = deselectAll;
    expDeselectBtn.onclick = deselectAll;

    viewAllBtn.onclick = () => { explorerModal.style.display = "flex"; document.body.style.overflow = "hidden"; };
    closeExplorerModal.onclick = () => { explorerModal.style.display = "none"; document.body.style.overflow = "auto"; };
    closeImageModal.onclick = () => imageModal.style.display = "none";

    window.onclick = (e) => {
        if (e.target === imageModal) imageModal.style.display = "none";
        if (e.target === explorerModal) { explorerModal.style.display = "none"; document.body.style.overflow = "auto"; }
    };
});