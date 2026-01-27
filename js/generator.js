/**
 * 골구도 생성 및 편집을 담당하는 클래스
 * - 기능: 그리드 생성, 드래그 선택, 병합, 활성/비활성 토글, 데이터 추출
 */
export class VisualGenerator {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.table = null;
        this.isDragging = false;
        this.startCell = null;
        this.selectedCells = [];
        this.historyStack = []; 
        this.menu = document.getElementById('context-menu');
        
        // 메뉴 닫기 및 드래그 종료 (문서 전체 감지)
        document.addEventListener('click', () => this.hideMenu());
        document.addEventListener('mouseup', () => this.onMouseUp());
    }

    createGrid(maxFloor, maxLine) {
        this.container.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'grid-table';
        
        // 테이블 자체 드래그 방지
        table.addEventListener('dragstart', (e) => e.preventDefault());

        for (let f = maxFloor; f >= 1; f--) {
            const tr = document.createElement('tr');
            for (let l = 1; l <= maxLine; l++) {
                const td = document.createElement('td');
                td.className = 'grid-cell';
                td.dataset.floor = f;
                td.dataset.line = l;
                
                // 호수 계산 (10호 라인 처리 포함)
                const lineStr = l < 10 ? `0${l}` : `${l}`;
                td.dataset.ho = `${f}${lineStr}`; 
                td.textContent = td.dataset.ho;
                
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        this.container.appendChild(table);
        this.table = table;

        this.reattachEvents();
        this.historyStack = [];
    }

    reattachEvents() {
        if (!this.table) return;
        
        // [수정] 이벤트 핸들러 바인딩 (this 유지)
        this.table.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        this.table.addEventListener('click', (e) => this.handleLeftClick(e));
        this.table.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.table.addEventListener('mouseover', (e) => this.onMouseOver(e));
    }

    saveState() {
        if (!this.table) return;
        this.historyStack.push(this.table.outerHTML);
        if (this.historyStack.length > 20) this.historyStack.shift();
    }

    undo() {
        if (this.historyStack.length === 0) {
            alert("되돌릴 작업이 없습니다.");
            return;
        }
        const lastState = this.historyStack.pop();
        this.container.innerHTML = '';
        this.container.insertAdjacentHTML('beforeend', lastState);
        this.table = this.container.querySelector('table');
        this.reattachEvents();
        this.selectedCells = [];
        // 복구 후 selected 클래스가 남아있을 수 있으므로 JS 객체와 동기화
        this.table.querySelectorAll('.selected').forEach(td => td.classList.remove('selected'));
    }

    // =========================================
    // 마우스 이벤트 핸들러 (핵심 수정 부분)
    // =========================================

    onMouseDown(e) {
        if (e.button === 2) return; // 우클릭 무시
        
        // [수정] closest 사용: 텍스트나 내부 요소를 클릭해도 TD를 찾음
        const td = e.target.closest('td');
        if (!td) return;

        this.isDragging = true;
        this.clearSelection();
        this.startCell = td;
        this.selectRange(this.startCell, td);
    }

    onMouseOver(e) {
        if (!this.isDragging) return;
        const td = e.target.closest('td'); // [수정] closest 사용
        if (!td) return;
        
        this.selectRange(this.startCell, td);
    }

    onMouseUp() {
        this.isDragging = false;
    }

    handleContextMenu(e) {
        e.preventDefault(); // 기본 메뉴 차단
        const td = e.target.closest('td'); // [수정] closest 사용
        if (!td) return;

        // 클릭한 셀이 이미 선택된 그룹 안에 있는지 확인
        const isClickedCellSelected = this.selectedCells.some(cell => 
            cell === td || (cell.dataset && cell.dataset.ho === td.dataset.ho)
        );
        
        if (!isClickedCellSelected) {
            // 영역 밖 클릭 -> 해당 셀만 새로 선택
            this.clearSelection();
            this.selectedCells = [td];
            td.classList.add('selected');
        }

        this.showMenu(e.pageX, e.pageY);
    }

    handleLeftClick(e) {
        const td = e.target.closest('td');
        if (!td) return;

        const rs = parseInt(td.rowSpan) || 1;
        const cs = parseInt(td.colSpan) || 1;

        // 병합된 셀이나 특수 명칭(숫자가 아닌 경우) 수정
        if (rs > 1 || cs > 1 || isNaN(td.textContent)) {
            this.saveState();
            const currentName = td.textContent;
            const newName = prompt("명칭을 수정하세요:", currentName);
            if (newName !== null) {
                td.textContent = newName;
                td.dataset.ho = newName;
                td.classList.add('special');
            }
        }
    }

    // =========================================
    // 선택 및 메뉴 로직
    // =========================================

    selectRange(start, end) {
        // 기존 시각적 선택 해제
        if(this.table) this.table.querySelectorAll('.selected').forEach(td => td.classList.remove('selected'));
        this.selectedCells = [];

        const f1 = parseInt(start.dataset.floor);
        const l1 = parseInt(start.dataset.line);
        const f2 = parseInt(end.dataset.floor);
        const l2 = parseInt(end.dataset.line);

        const minF = Math.min(f1, f2);
        const maxF = Math.max(f1, f2);
        const minL = Math.min(l1, l2);
        const maxL = Math.max(l1, l2);

        for (let f = minF; f <= maxF; f++) {
            for (let l = minL; l <= maxL; l++) {
                const cell = this.table.querySelector(`td[data-floor="${f}"][data-line="${l}"]`);
                // 병합되어 숨겨진 셀(display: none)은 선택 배열에 넣지 않음
                if (cell && cell.style.display !== 'none') {
                    cell.classList.add('selected');
                    this.selectedCells.push(cell);
                }
            }
        }
    }

    clearSelection() {
        if(this.table) this.table.querySelectorAll('.selected').forEach(td => td.classList.remove('selected'));
        this.selectedCells = [];
    }

    showMenu(x, y) {
        if(this.menu) {
            this.menu.style.display = 'block';
            this.menu.style.left = `${x}px`;
            this.menu.style.top = `${y}px`;
        }
    }

    hideMenu() {
        if(this.menu) this.menu.style.display = 'none';
    }

    // =========================================
    // 액션 메서드 (우클릭 메뉴용)
    // =========================================

    actionSetType() {
        if (this.selectedCells.length === 0) return;
        this.saveState();
        const currentType = this.selectedCells[0].dataset.type || '';
        const newType = prompt("타입(Type) 입력 (예: 84A):", currentType);
        if (newType !== null) {
            this.selectedCells.forEach(cell => {
                cell.dataset.type = newType;
                if(!cell.classList.contains('void')) cell.style.backgroundColor = '#e8f5e9'; 
            });
        }
    }

    actionMerge() {
        if (this.selectedCells.length < 2) return;
        this.saveState();
        
        // 1. 범위 계산
        let minF = Infinity, maxF = -Infinity, minL = Infinity, maxL = -Infinity;
        this.selectedCells.forEach(cell => {
            const f = parseInt(cell.dataset.floor);
            const l = parseInt(cell.dataset.line);
            if (f < minF) minF = f;
            if (f > maxF) maxF = f;
            if (l < minL) minL = l;
            if (l > maxL) maxL = l;
        });

        // 2. 기준 셀(좌상단) 찾기
        const rootCell = this.table.querySelector(`td[data-floor="${maxF}"][data-line="${minL}"]`);
        if (!rootCell) return;

        const rowSpan = (maxF - minF) + 1;
        const colSpan = (maxL - minL) + 1;

        // 3. 병합 적용
        rootCell.rowSpan = rowSpan;
        rootCell.colSpan = colSpan;
        rootCell.classList.add('merged');

        // 4. 나머지 셀 숨김
        this.selectedCells.forEach(cell => {
            if (cell !== rootCell) {
                cell.style.display = 'none';
                cell.dataset.merged = "true"; 
            }
        });
        this.clearSelection();
    }

    actionToggleDisable() {
        if (this.selectedCells.length === 0) return;
        this.saveState();
        this.selectedCells.forEach(cell => {
            cell.classList.toggle('disabled');
            cell.classList.remove('void');
        });
        this.clearSelection();
    }

    actionDelete() {
        if (this.selectedCells.length === 0) return;
        if (confirm("선택한 영역을 삭제(Void) 처리하시겠습니까?")) {
            this.saveState();
            this.selectedCells.forEach(cell => {
                cell.classList.add('void');
                cell.classList.remove('disabled');
                cell.textContent = ''; 
            });
            this.clearSelection();
        }
    }

    actionRename() {
        if (this.selectedCells.length === 0) return;
        this.saveState();
        const cell = this.selectedCells[0];
        const newName = prompt("명칭 수정:", cell.textContent);
        if (newName !== null) {
            this.selectedCells.forEach(c => {
                c.textContent = newName;
                c.dataset.ho = newName;
                c.classList.add('special');
            });
        }
    }

    exportData(siteName, dongName) {
        const units = [];
        if(!this.table) return units;
        
        const allCells = this.table.querySelectorAll('td');
        allCells.forEach(cell => {
            if (cell.dataset.merged === "true") return; // 숨겨진 셀 제외

            units.push({
                site_name: siteName,
                unique_id: `${siteName}_${dongName}_${cell.dataset.ho}`,
                dong: dongName,
                floor: parseInt(cell.dataset.floor),
                line: parseInt(cell.dataset.line),
                ho: cell.dataset.ho,
                type: cell.dataset.type || '',
                row_span: cell.rowSpan,
                col_span: cell.colSpan,
                is_void: cell.classList.contains('void'),
                is_disabled: cell.classList.contains('disabled'),
                status: 'before',
                memo: ''
            });
        });
        return units;
    }
}