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
                // Void가 아닐 때만 색상 힌트
                if(!cell.classList.contains('void')) cell.style.backgroundColor = '#e8f5e9'; 
            });
        }
    }

    // [기존 유지] 병합
    actionMerge() {
        // .selectedCells는 함수가 아니라 '배열'이므로 ()를 붙이면 안 됩니다.
        if (this.selectedCells.length < 2) {
            alert("병합할 셀을 2개 이상 선택해주세요.");
            return;
        }
        this.saveState();
        this.mergeCells();
    }
    /**
     * 실제 셀 병합 로직 (작업자)
     */
    mergeCells() {
        // 1. 선택된 셀들의 전체 범위(최소/최대 층과 라인) 계산
        let minF = Infinity, maxF = -Infinity, minL = Infinity, maxL = -Infinity;
        this.selectedCells.forEach(cell => {
            const f = parseInt(cell.dataset.floor);
            const l = parseInt(cell.dataset.line);
            if (f < minF) minF = f;
            if (f > maxF) maxF = f;
            if (l < minL) minL = l;
            if (l > maxL) maxL = l;
        });

        // 2. 기준 셀(좌상단 셀) 찾기
        // 우리 그리드 구조상 가장 높은 층(maxF)과 가장 낮은 라인(minL)이 기준입니다.
        const rootCell = this.table.querySelector(`td[data-floor="${maxF}"][data-line="${minL}"]`);
        
        if (!rootCell) {
            alert("기준 셀을 찾을 수 없습니다.");
            return;
        }

        // 3. 병합 크기 계산
        const rowSpan = (maxF - minF) + 1;
        const colSpan = (maxL - minL) + 1;

        // 4. 기준 셀에 병합 속성 적용
        rootCell.rowSpan = rowSpan;
        rootCell.colSpan = colSpan;
        rootCell.classList.add('merged'); // 병합된 셀임을 표시하는 클래스 추가

        // 5. 나머지 셀들 숨김 처리 (데이터 유지를 위해 삭제가 아닌 display: none 처리)
        this.selectedCells.forEach(cell => {
            if (cell !== rootCell) {
                cell.style.display = 'none';
                cell.dataset.merged = "true"; // 데이터 추출 시 제외하기 위한 플래그
            }
        });

        // 6. 선택 해제
        this.clearSelection();
    }

    // [신규 기능] 병합 해제
    actionUnmerge() {
        // 선택된 셀 중 병합된 셀(merged class 또는 rowSpan/colSpan > 1)이 있는지 확인
        const mergedCells = this.selectedCells.filter(cell => 
            cell.rowSpan > 1 || cell.colSpan > 1 || cell.classList.contains('merged')
        );

        if (mergedCells.length === 0) {
            // 선택된 셀이 없다면, 현재 우클릭한 셀(startCell)이 병합된 셀인지 확인해볼 수 있음
            // 하지만 UX상 명시적으로 선택하고 누르는 게 안전함.
            alert("병합된 셀을 선택해주세요.");
            return;
        }

        this.saveState(); // 실행 취소 저장

        mergedCells.forEach(rootCell => {
            const rs = rootCell.rowSpan;
            const cs = rootCell.colSpan;
            const startF = parseInt(rootCell.dataset.floor);
            const startL = parseInt(rootCell.dataset.line);

            // 1. 병합 속성 초기화
            rootCell.rowSpan = 1;
            rootCell.colSpan = 1;
            rootCell.classList.remove('merged');

            // 2. 숨겨졌던 셀들(display: none)을 다시 보이게 처리
            // 병합 범위: [startF ~ startF-(rs-1)] , [startL ~ startL+(cs-1)]
            // 주의: 우리 그리드는 위쪽(f)이 큰 숫자
            
            for(let i = 0; i < rs; i++) {
                for(let j = 0; j < cs; j++) {
                    if(i===0 && j===0) continue; // 본인은 제외
                    
                    const targetF = startF - i;
                    const targetL = startL + j;
                    
                    const hiddenCell = this.table.querySelector(`td[data-floor="${targetF}"][data-line="${targetL}"]`);
                    if(hiddenCell) {
                        hiddenCell.style.display = ''; // 보임 처리
                        hiddenCell.dataset.merged = "false"; // 플래그 해제
                    }
                }
            }
        });
        
        this.clearSelection();
    }

    // [기존 유지] 사용/제외 토글
    actionToggleDisable() {
        if (this.selectedCells.length === 0) return;
        this.saveState();
        this.selectedCells.forEach(cell => {
            cell.classList.toggle('disabled');
            cell.classList.remove('void');
        });
        this.clearSelection();
    }

    // [기능 개선] 삭제 / 복구 토글 (Toggle)
    actionDelete() {
        if (this.selectedCells.length === 0) return;

        // 선택된 셀 중 하나라도 void가 아니면 -> 모두 void로 (삭제)
        // 모두 void라면 -> 모두 복구
        const hasActive = this.selectedCells.some(cell => !cell.classList.contains('void'));
        
        this.saveState();

        if (hasActive) {
            // 삭제 모드
            if (confirm("선택한 영역을 삭제(Void) 처리하시겠습니까?")) {
                this.selectedCells.forEach(cell => {
                    cell.classList.add('void');
                    cell.classList.remove('disabled');
                    // 텍스트는 데이터셋에 남아있으므로 비워도 됨 (복구 시 다시 채움)
                    // 하지만 편의상 텍스트는 안보이게 CSS 처리되어 있으므로 유지해도 됨.
                });
            }
        } else {
            // 복구 모드
            if (confirm("선택한 영역을 복구하시겠습니까?")) {
                this.selectedCells.forEach(cell => {
                    cell.classList.remove('void');
                });
            }
        }
        this.clearSelection();
    }

    // [기존 유지] 명칭 수정
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