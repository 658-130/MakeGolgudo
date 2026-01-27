// js/main_admin.js

import { VisualGenerator } from './generator.js';
import { VisualEditor } from './editor.js';
import { SheetAPI } from './api.js';

let generator, editor;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 인스턴스 초기화
    generator = new VisualGenerator('gen-container');
    editor = new VisualEditor('edit-container');

    // 2. 탭 전환 함수
    window.showSection = (sectionId) => {
        // 섹션 전환
        document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
        document.getElementById(`section-${sectionId}`).classList.add('active');
        
        // 메뉴 활성화 표시
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        // 클릭된 메뉴 찾기 (간단한 처리)
        const menuIndex = sectionId === 'generator' ? 0 : sectionId === 'editor' ? 1 : 2;
        const menuItems = document.querySelectorAll('.menu-item');
        if(menuItems[menuIndex]) menuItems[menuIndex].classList.add('active');

        // 수정기 진입 시 목록 갱신
        if (sectionId === 'editor') {
            const select = document.getElementById('edit-select-dong');
            editor.loadDongList(select);
        }
    };

    // ============================================================
    // [핵심 수정] 우클릭 메뉴 이벤트 연결 (여기가 빠져서 동작 안했음)
    // ============================================================
    
    // 현재 어떤 탭이 활성화되어 있는지 확인하여 해당 인스턴스 반환
    function getActiveInstance() {
        if (document.getElementById('section-generator').classList.contains('active')) {
            return generator;
        } else if (document.getElementById('section-editor').classList.contains('active')) {
            return editor;
        }
        return null;
    }

    // 메뉴 클릭 핸들러
    const handleMenuClick = (actionName) => {
        const instance = getActiveInstance();
        if (instance) {
            // 인스턴스의 메서드 실행 (예: generator.actionSetType())
            if (typeof instance[actionName] === 'function') {
                instance[actionName]();
            }
        }
        // 메뉴 닫기
        document.getElementById('context-menu').style.display = 'none';
    };

    // 각 메뉴 아이템에 클릭 이벤트 연결
    document.getElementById('menu-set-type').onclick = () => handleMenuClick('actionSetType');
    document.getElementById('menu-merge').onclick = () => handleMenuClick('actionMerge');
    document.getElementById('menu-toggle').onclick = () => handleMenuClick('actionToggleDisable');
    document.getElementById('menu-delete').onclick = () => handleMenuClick('actionDelete');
    document.getElementById('menu-rename').onclick = () => handleMenuClick('actionRename');

    // ============================================================
    // [페이지 1: 생성기 이벤트]
    // ============================================================
    document.getElementById('btn-gen-create').addEventListener('click', () => {
        const f = parseInt(document.getElementById('gen-floor').value);
        const l = parseInt(document.getElementById('gen-line').value);
        if(f > 0 && l > 0) generator.createGrid(f, l);
        else alert("층과 라인 수를 올바르게 입력해주세요.");
    });

    document.getElementById('btn-gen-undo').addEventListener('click', () => generator.undo());

    document.getElementById('btn-gen-save').addEventListener('click', async () => {
        const site = document.getElementById('gen-site').value.trim();
        const dong = document.getElementById('gen-dong').value.trim();
        
        if (!site || !dong) return alert("현장명과 동 번호를 입력해주세요.");

        const data = generator.exportData(site, dong);
        if (data.length === 0) return alert("저장할 데이터가 없습니다.");

        const btn = document.getElementById('btn-gen-save');
        btn.disabled = true; 
        btn.textContent = "저장 중...";

        try {
            const res = await SheetAPI.action('create_bulk', { data });
            if (res.result === 'success') alert(`[저장 완료] 총 ${res.saved}건 저장`);
            else alert(res.message);
        } catch (e) {
            console.error(e);
            alert("통신 오류 발생");
        } finally {
            btn.disabled = false;
            btn.textContent = "💾 서버 저장";
        }
    });

    // ============================================================
    // [페이지 2: 수정기 이벤트]
    // ============================================================
    document.getElementById('btn-edit-load').addEventListener('click', () => {
        const val = document.getElementById('edit-select-dong').value;
        if (!val) return alert("동을 선택해주세요.");
        const item = JSON.parse(val);
        editor.loadDongData(item.site_name, item.dong);
    });

    document.getElementById('btn-edit-apply').addEventListener('click', () => {
        if (!editor.siteName) return alert("먼저 동 데이터를 불러와주세요.");
        const f = parseInt(document.getElementById('edit-floor').value);
        const l = parseInt(document.getElementById('edit-line').value);
        if (confirm("구조를 변경하면 기존 병합이 초기화될 수 있습니다. 진행하시겠습니까?")) {
            editor.applyStructureChange(f, l);
        }
    });

    document.getElementById('btn-edit-delete').addEventListener('click', async () => {
        if (!editor.siteName) return;
        if (confirm(`[경고] '${editor.siteName} ${editor.dongName}동'을 영구 삭제하시겠습니까?`)) {
            const res = await SheetAPI.action('delete_dong', { site_name: editor.siteName, dong: editor.dongName });
            if (res.result === 'success') {
                alert("삭제되었습니다.");
                document.getElementById('edit-container').innerHTML = '';
                editor.loadDongList(document.getElementById('edit-select-dong'));
                document.getElementById('edit-site-display').value = '';
                document.getElementById('edit-dong-display').value = '';
            } else {
                alert("실패: " + res.message);
            }
        }
    });

    document.getElementById('btn-edit-update').addEventListener('click', async () => {
        if (!editor.siteName) return;
        const data = editor.exportData(editor.siteName, editor.dongName);
        if (confirm("수정된 내용을 덮어쓰시겠습니까?")) {
            const res = await SheetAPI.action('update_dong', { data });
            if (res.result === 'success') alert("수정 완료");
            else alert("오류: " + res.message);
        }
    });
});