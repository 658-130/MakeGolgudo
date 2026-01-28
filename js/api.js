// js/api.js

const API_URL = "https://script.google.com/macros/s/AKfycbxxnax7ZCRLBeevdxJBs58PMQ606l0DRQkjDgxECxG7XcZAPUX__b1r5rutQUrlcBdCkw/exec"; // [필수] 배포 후 URL 입력

// 로딩 화면 제어 함수 (전역 사용)
window.showLoading = () => {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'flex';
};

window.hideLoading = () => {
    const loader = document.getElementById('global-loader');
    if (loader) loader.style.display = 'none';
};

export const SheetAPI = {
    action: async (actionName, payload = {}) => {
        // 1. 요청 시작 시 로딩 표시
        window.showLoading();

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ action: actionName, data: payload }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return result;

        } catch (error) {
            console.error("API Error:", error);
            return { result: "error", message: error.toString() };
        } finally {
            // 2. 요청 종료(성공/실패) 시 로딩 숨김
            window.hideLoading();
        }
    }
};