export const BASE_URL = "https://moist-facete-penney.ngrok-free.dev"; //주소 입력

export const API_endpoints = {
    UPLOAD: `${BASE_URL}/api/dicom/upload`,
    HISTORY: `${BASE_URL}/api/dicom/history`,

    CONVERT: (id) => `${BASE_URL}/api/dicom/convert/${id}`,
    DOWNLOAD: (id) => `${BASE_URL}/api/dicom/download/${id}`,
    HISTORY_DETAIL: (id) => `${BASE_URL}/api/dicom/history/${id}`
};