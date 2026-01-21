// js/api.js

// 방금 복사한 GAS 웹 앱 URL을 여기에 붙여넣으세요.
const GAS_URL = "https://script.google.com/macros/s/AKfycbxxnax7ZCRLBeevdxJBs58PMQ606l0DRQkjDgxECxG7XcZAPUX__b1r5rutQUrlcBdCkw/exec"; 

export const SheetAPI = {
  /**
   * 데이터를 구글 시트로 전송 (C/U/D)
   * @param {string} type - 액션 타입 (예: 'create_bulk')
   * @param {object} payload - 전송할 데이터 본문
   */
  async action(type, payload) {
    // GAS는 POST 요청을 보낼 때 text/plain으로 보내야 CORS 에러를 피하기 쉽습니다.
    const response = await fetch(GAS_URL, {
      method: "POST",
      // mode: "no-cors", // 주의: no-cors를 쓰면 응답 내용을 못 읽음. GAS 배포 설정이 올바르면 cors 모드 사용 가능.
      headers: {
        "Content-Type": "text/plain;charset=utf-8", 
      },
      body: JSON.stringify({ action: type, ...payload }),
    });

    const result = await response.json();
    return result;
  },
};