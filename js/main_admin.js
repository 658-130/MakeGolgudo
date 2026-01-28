import { VisualGenerator } from './generator.js';
import { VisualEditor } from './editor.js';
import { SheetAPI } from './api.js';

let generator, editor;

document.addEventListener('DOMContentLoaded', () => {
    // 1. 인스턴스 초기화
    generator = new VisualGenerator('gen-container');
    editor = new VisualEditor('edit-container');

    // 2. 탭 전환 통합 관리
    window.showSection = (sectionId) => {
        // 섹션 활성화
        document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
        const targetSection = document.getElementById(`section-${sectionId}`);
        if (targetSection) targetSection.classList.add('active');
        
        // 사이드바 메뉴 활성화
        document.querySelectorAll('.sidebar .menu-item').forEach(el => el.classList.remove('active'));
        const menuIdx = sectionId === 'generator' ? 0 : sectionId === 'editor' ? 1 : 2;
        const menuItems = document.querySelectorAll('.sidebar .menu-item');
        if (menuItems[menuIdx]) menuItems[menuIdx].classList.add('active');

        // [특수 로직] 수정기 진입 시 동 목록 갱신
        if (sectionId === 'editor') {
            const select = document.getElementById('edit-select-dong');
            editor.loadDongList(select);
        }

        // [특수 로직] 뷰어 진입 시 새로고침
        if (sectionId === 'viewer') {
            const iframe = document.getElementById('viewer-frame');
            if (iframe) iframe.src = iframe.src;
        }
    };

    // ============================================================
    // [핵심] 우클릭 메뉴 이벤트 연결 (병합/삭제 등 모든 기능)
    // ============================================================
    
    function getActiveInstance() {
        if (document.getElementById('section-generator').classList.contains('active')) return generator;
        if (document.getElementById('section-editor').classList.contains('active')) return editor;
        return null;
    }

    const handleMenuClick = (actionName) => {
        const instance = getActiveInstance();
        if (instance && typeof instance[actionName] === 'function') {
            instance[actionName]();
        }
        const menu = document.getElementById('context-menu');
        if (menu) menu.style.display = 'none';
    };

    // HTML에 정의된 ID와 일치하도록 연결
    const menuMappings = {
        'menu-set-type': 'actionSetType',
        'menu-merge': 'actionMerge',
        'menu-unmerge': 'actionUnmerge', // 병합 해제 기능
        'menu-toggle': 'actionToggleDisable',
        'menu-delete': 'actionDelete',
        'menu-rename': 'actionRename'
    };

    Object.entries(menuMappings).forEach(([id, action]) => {
        const element = document.getElementById(id);
        if (element) {
            element.onclick = () => handleMenuClick(action);
        }
    });

    // ============================================================
    // 생성기(Generator) 이벤트
    // ============================================================
    document.getElementById('btn-gen-create').addEventListener('click', () => {
        const f = parseInt(document.getElementById('gen-floor').value);
        const l = parseInt(document.getElementById('gen-line').value);
        if(f > 0 && l > 0) generator.createGrid(f, l);
        else alert("층과 라인 수를 입력하세요.");
    });

    document.getElementById('btn-gen-undo').addEventListener('click', () => generator.undo());

    document.getElementById('btn-gen-save').addEventListener('click', async () => {
        const site = document.getElementById('gen-site').value.trim();
        const dong = document.getElementById('gen-dong').value.trim();
        if (!site || !dong) return alert("현장명과 동을 입력하세요.");

        const data = generator.exportData(site, dong);
        if (data.length === 0) return alert("저장할 데이터가 없습니다.");

        const res = await SheetAPI.action('create_bulk', data);
        if (res.result === 'success') alert(`[성공] ${res.saved}건 저장 완료`);
        else alert(res.message);
    });

    // ============================================================
    // 수정기(Editor) 이벤트
    // ============================================================
    document.getElementById('btn-edit-load').addEventListener('click', () => {
        const val = document.getElementById('edit-select-dong').value;
        if (!val) return alert("동을 선택하세요.");
        try {
            const item = JSON.parse(val);
            editor.loadDongData(item.site_name, item.dong);
        } catch (e) {
            alert("데이터 파싱 오류");
        }
    });

    document.getElementById('btn-edit-apply').addEventListener('click', () => {
        if (!editor.siteName) return alert("동 데이터를 먼저 불러오세요.");
        const f = parseInt(document.getElementById('edit-floor').value);
        const l = parseInt(document.getElementById('edit-line').value);
        if (confirm("구조 변경 시 병합이 초기화될 수 있습니다. 진행할까요?")) {
            editor.applyStructureChange(f, l);
        }
    });

    document.getElementById('btn-edit-delete').addEventListener('click', async () => {
        if (!editor.siteName) return;
        if (confirm(`'${editor.siteName} ${editor.dongName}동' 데이터를 영구 삭제할까요?`)) {
            const res = await SheetAPI.action('delete_dong', { site_name: editor.siteName, dong: editor.dongName });
            if (res.result === 'success') {
                alert("삭제되었습니다.");
                document.getElementById('edit-container').innerHTML = '';
                editor.loadDongList(document.getElementById('edit-select-dong'));
            }
        }
    });

    document.getElementById('btn-edit-update').addEventListener('click', async () => {
        if (!editor.siteName) return;
        const data = editor.exportData(editor.siteName, editor.dongName);
        if (confirm("수정된 내용을 서버에 덮어쓰시겠습니까?")) {
            const res = await SheetAPI.action('update_dong', data);
            if (res.result === 'success') alert("수정 완료");
            else alert("오류: " + res.message);
        }
    });
});