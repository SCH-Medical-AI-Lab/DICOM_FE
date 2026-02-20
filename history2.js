/**
 * history2.js
 * 사용자님이 제공해주신 Ngrok 우회 헤더 방식을 적용한 코드입니다.
 */

// ★ 서버 주소가 바뀌면 이 부분만 수정하세요.
const BASE_URL = 'https://moist-facete-penney.ngrok-free.dev';

const API = {
    LIST: `${BASE_URL}/api/dicom/history`,
    DETAIL: (id) => `${BASE_URL}/api/dicom/history/${id}`
};

// ===== 1. API 호출 함수 (제시해주신 fetch 방식 적용) =====

async function fetchListData() {
    console.log("목록 조회 요청...");
    try {
        const res = await fetch(API.LIST, {
            method: 'GET',
            headers: {
                // ★ 핵심: Ngrok 경고 페이지를 건너뛰게 해주는 헤더입니다.
                'ngrok-skip-browser-warning': '69420',
                'Content-Type': 'application/json'
            }
        });
        
        if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
        return await res.json();
    } catch (error) {
        console.warn("⚠️ 서버 연결 실패! 테스트용 데이터를 표시합니다.");
        return [
            { id: 1, patientName: "연결 테스트용", conversionStatus: "SUCCESS", studyDate: "20260219" }
        ];
    }
}

async function fetchDetailData(id) {
    console.log(`상세 조회 요청: ID ${id}`);
    try {
        const res = await fetch(API.DETAIL(id), {
            method: 'GET',
            headers: {
                'ngrok-skip-browser-warning': '69420',
                'Content-Type': 'application/json'
            }
        });
        
        if (!res.ok) throw new Error('상세 데이터를 찾을 수 없습니다.');
        return await res.json();
    } catch (error) {
        throw error;
    }
}

// ===== 2. 화면 제어 및 이벤트 핸들러 =====

function getStatusBadge(status) {
    const s = (status || 'UNKNOWN').toUpperCase();
    let colorClass = 'status-unknown'; 
    if (s.includes('SUCC')) colorClass = 'status-success';
    else if (s.includes('FAIL')) colorClass = 'status-failed';
    else if (s.includes('PROCES') || s.includes('PEND')) colorClass = 'status-processing';
    return `<span class="status-badge ${colorClass}">${s}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
    // [목록 불러오기] 버튼
    document.getElementById('loadButton').addEventListener('click', async () => {
        const tableBody = document.getElementById('listTableBody');
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('listSection').classList.add('hidden');

        const data = await fetchListData();
        tableBody.innerHTML = '';
        
        data.sort((a, b) => a.id - b.id).forEach(item => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${item.id}</td>
                <td>${item.patientName || item.fileName || '-'}</td>
                <td>${getStatusBadge(item.conversionStatus || item.status)}</td>
                <td>${item.studyDate || '-'}</td>
                <td><button onclick="loadDetail(${item.id})" class="btn-text">상세보기</button></td>
            `;
            tableBody.appendChild(tr);
        });

        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('listSection').classList.remove('hidden');
    });

    // [검색] 버튼
    document.getElementById('searchButton').addEventListener('click', () => {
        const id = document.getElementById('searchIdInput').value;
        if (id) window.loadDetail(id);
    });

    // [닫기] 버튼
    document.getElementById('closeDetailBtn').addEventListener('click', () => {
        document.getElementById('detailSection').classList.add('hidden');
    });
});

// ===== 3. 전역 상세 조회 함수 (window 객체 등록) =====
window.loadDetail = async (id) => {
    document.getElementById('searchIdInput').value = id;
    const detailSection = document.getElementById('detailSection');
    const loading = document.getElementById('loadingState');

    loading.classList.remove('hidden');
    detailSection.classList.add('hidden');

    try {
        const data = await fetchDetailData(id);
        
        document.getElementById('detailId').textContent = data.id;
        document.getElementById('detailName').textContent = data.patientName || '-';
        document.getElementById('detailStatus').innerHTML = getStatusBadge(data.conversionStatus || data.status);
        document.getElementById('detailStudyDate').textContent = data.studyDate || '-';
        document.getElementById('detailModality').textContent = data.modality || '-';

        const path = data.pngPath || data.pngUrl;
        if (path) {
            const fullUrl = path.startsWith('http') ? path : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
            const link = document.getElementById('detailPngUrl');
            link.href = fullUrl;
            link.textContent = "이미지 보기";
            document.getElementById('previewImage').src = fullUrl;
            document.getElementById('imagePreviewSection').classList.remove('hidden');
        } else {
            document.getElementById('imagePreviewSection').classList.add('hidden');
        }

        detailSection.classList.remove('hidden');
    } catch (error) {
        alert("상세 정보를 가져오는 데 실패했습니다.");
    } finally {
        loading.classList.add('hidden');
    }
};