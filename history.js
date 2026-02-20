import { API_endpoints } from './config.js';

async function fetchHistory() {
    const listElement = document.getElementById('history-list');

    try {
        // ★ [수정] Ngrok 헤더 추가
        const response = await fetch(API_endpoints.HISTORY, {
            headers: {
                'ngrok-skip-browser-warning': '69420'
            }
        });

        if (!response.ok) throw new Error('조회 실패');
        
        const data = await response.json();
        listElement.innerHTML = '';

        if (data.length === 0) {
            listElement.innerHTML = '<tr><td colspan="5" style="padding: 30px; color: #999;">변환된 내역이 없습니다.</td></tr>';
            return;
        }

        data.forEach(item => {
            const tr = document.createElement('tr');
            // 상태값 안전 처리
            const status = item.conversionStatus || item.status || 'UNKNOWN';
            const statusClass = (status === "SUCCESS" || status === "SUCESS") ? "status-success" : "status-fail";
            const patientName = item.patientName || '-';
            const truncatedName = patientName.length > 15 ? patientName.substring(0, 15) + '...' : patientName;

            tr.innerHTML = `
                <td>#${item.id}</td>
                <td title="${patientName}">${truncatedName}</td>
                <td>${item.modality || '-'}</td>
                <td><span class="status-badge ${statusClass}">${status}</span></td>
                <td><a href="download.html?id=${item.id}" class="view-link">보기</a></td>
            `;
            listElement.appendChild(tr);
        });

    } catch (error) {
        console.error(error);
        listElement.innerHTML = '<tr><td colspan="5" style="padding: 30px; color: #fa5252;">서버 연결에 실패했습니다.</td></tr>';
    }
}

// 페이지 로드 시 즉시 실행
window.onload = fetchHistory;