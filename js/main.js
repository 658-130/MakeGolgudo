// js/main.js
import { VisualGenerator } from './generator.js';
import { SheetAPI } from './api.js'; 

document.addEventListener('DOMContentLoaded', () => {
    // 1. 생성기 인스턴스 초기화
    const generator = new VisualGenerator('grid-container');

    // 저장된 현장명 불러오기 (새로고침 해도 유지됨)
    const savedSiteName = localStorage.getItem('last_site_name');
    if (savedSiteName) {
        document.getElementById('input-site').value = savedSiteName;
    }
    // 현장명 입력 시마다 저장
    document.getElementById('input-site').addEventListener('input', (e) => {
        localStorage.setItem('last_site_name', e.target.value);
    });

    // 2. 이벤트 리스너 연결
    // [그리드 생성] 버튼
    document.getElementById('btn-create').addEventListener('click', () => {
        const floor = document.getElementById('input-floor').value;
        const line = document.getElementById('input-line').value;

        if (!floor || !line) {
            alert("층수와 라인수를 입력해주세요.");
            return;
        }

        // 생성 전 확인
        if (confirm(`최고 ${floor}층, ${line}호 라인의 그리드를 생성하시겠습니까?\n기존 작업 내용은 초기화됩니다.`)) {
            generator.createGrid(parseInt(floor), parseInt(line));
        }
    });
    // [저장] 버튼
    document.getElementById('btn-save').addEventListener('click', async () => {
        const siteName = document.getElementById('input-site').value.trim(); // [추가됨]
        const dong = document.getElementById('input-dong').value;
        if (!siteName) {
            alert("현장명을 입력해주세요.");
            document.getElementById('input-site').focus();
            return;
        }
        if (!dong) {
            alert("동(Dong) 번호를 입력해주세요.");
            document.getElementById('input-dong').focus();
            return;
        }

        // generator에서 JSON 데이터 추출
        const unitsData = generator.exportData(siteName,dong);

        if (unitsData.length === 0) {
            alert("저장할 데이터가 없습니다.");
            return;
        }

        console.log("=== [전송할 데이터 미리보기] ===");
        console.table(unitsData); // 개발자 도구 콘솔에서 데이터 확인
        console.log(JSON.stringify(unitsData, null, 2));

        try {
            const btn = document.getElementById('btn-save');
            const originalText = btn.textContent;
            btn.textContent = "저장 중...";
            btn.disabled = true;

            const res = await SheetAPI.action('create_bulk', { data: unitsData });
            
            if(res.result === 'success') {
                alert(`[${siteName} ${dong}동] 저장 성공!\n총 ${res.saved}건 저장, ${res.duplicates}건 중복 제외.`);
            } else {
                alert("오류 발생: " + res.message);
            }

            btn.textContent = originalText;
            btn.disabled = false;

        } catch (error) {
            console.error(error);
            alert("서버 통신 중 오류가 발생했습니다.");
            document.getElementById('btn-save').textContent = "서버 저장";
            document.getElementById('btn-save').disabled = false;
        }
        

        alert(`총 ${unitsData.length}개의 호실 데이터가 생성되었습니다.\n(콘솔창(F12)에서 JSON 데이터를 확인하세요)`);
    });
    // 컨텍스트 메뉴 이벤트 연결
    document.getElementById('menu-set-type').addEventListener('click', () => generator.actionSetType());
    document.getElementById('menu-rename').addEventListener('click', () => generator.actionRename());
    document.getElementById('menu-delete').addEventListener('click', () => generator.actionDelete());
    document.getElementById('menu-merge').addEventListener('click', () => generator.actionMerge());
    document.getElementById('menu-unmerge').addEventListener('click', () => generator.actionUnmerge());
    document.getElementById('menu-toggle').addEventListener('click', () => generator.actionToggleDisable());
});