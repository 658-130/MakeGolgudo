import { VisualGenerator } from './generator.js';
import { SheetAPI } from './api.js';

export class VisualEditor extends VisualGenerator {
    constructor(containerId) {
        super(containerId); // VisualGenerator의 초기화 로직(이벤트 연결 등) 재사용
        this.currentData = []; // DB에서 불러온 원본 데이터
        this.siteName = "";
        this.dongName = "";
    }

    /**
     * 동 목록 불러오기 (Dropdown 채우기)
     */
    async loadDongList(selectElement) {
        const res = await SheetAPI.action('get_site_dong_list', {});
        
        selectElement.innerHTML = '<option value="">현장 선택...</option>';

            if(res.result === 'success') {
            // [수정] 가나다순 정렬 로직 추가
            // 현장명(site_name) 우선 정렬 후, 동일 현장 내에서 동(dong) 정렬
            const sortedData = res.data.sort((a, b) => {
                if (a.site_name < b.site_name) return -1;
                if (a.site_name > b.site_name) return 1;
                // 현장명이 같으면 동 번호로 정렬
                return String(a.dong).localeCompare(String(b.dong), undefined, { numeric: true });
            });
            sortedData.forEach(item => {
                const opt = document.createElement('option');
                const valueObj = { site_name: item.site_name, dong: item.dong };
                opt.value = JSON.stringify(valueObj); 
                opt.textContent = `[${item.site_name}] ${item.dong}동`;
                selectElement.appendChild(opt);
            });
        }
    }

    /**
     * 특정 동 데이터 불러와서 화면에 그리기
     */
    async loadDongData(site, dong) {
        this.siteName = site;
        this.dongName = dong;
        
        // UI 표시
        const siteInput = document.getElementById('edit-site-display');
        const dongInput = document.getElementById('edit-dong-display');
        if(siteInput) siteInput.value = this.siteName;
        if(dongInput) dongInput.value = this.dongName;

        // 서버 요청
        const res = await SheetAPI.action('read_dong_detail', { site_name: site, dong: dong });
        
        if(res.result !== 'success') {
            alert("데이터 로드 실패: " + res.message);
            return;
        }

        if(!res.data || res.data.length === 0) {
            alert("해당 동의 데이터가 없습니다.");
            return;
        }

        this.currentData = res.data;
        this.renderFromData(this.currentData);
    }

    /**
     * DB 데이터를 기반으로 그리드 복원
     */
        renderFromData(units) {
        // 기존 컨테이너 비우기
        this.container.innerHTML = '';

        if (!units || units.length === 0) return;

        // 1. 최대 층/라인 계산
        const maxFloor = Math.max(...units.map(u => Number(u.floor)));
        const maxLine = Math.max(...units.map(u => Number(u.line)));
        
        // 입력창 동기화
        const floorInput = document.getElementById('edit-floor');
        const lineInput = document.getElementById('edit-line');
        if(floorInput) floorInput.value = maxFloor;
        if(lineInput) lineInput.value = maxLine;

        // 2. 테이블 수동 생성 (createGrid 사용 안 함)
        const table = document.createElement('table');
        table.className = 'grid-table';
        
        // 드래그 방지
        table.addEventListener('dragstart', (e) => e.preventDefault());

        // 데이터 매핑
        const unitMap = new Map();
        units.forEach(u => unitMap.set(`${u.floor}_${u.line}`, u));

        // [핵심] 병합 처리를 위한 방문 기록 배열 (2차원)
        // visited[층][라인] = true면 렌더링 건너뜀
        const visited = Array.from({ length: maxFloor + 1 }, () => Array(maxLine + 1).fill(false));

        for (let f = maxFloor; f >= 1; f--) {
            const tr = document.createElement('tr');
            for (let l = 1; l <= maxLine; l++) {
                // 이미 병합된 영역에 포함된 곳이면 건너뜀 (밀림 방지)
                if (visited[f][l]) continue;

                const unit = unitMap.get(`${f}_${l}`);
                const td = document.createElement('td');
                td.className = 'grid-cell';
                
                // 기본 좌표 데이터 심기
                td.dataset.floor = f;
                td.dataset.line = l;

                if (unit) {
                    // 데이터 복구
                    td.textContent = unit.ho;
                    td.dataset.ho = unit.ho;
                    if (unit.type) td.dataset.type = unit.type;
                    
                    if (unit.is_void === true || unit.is_void === "TRUE") {
                        td.classList.add('void');
                        td.textContent = ''; // Void는 텍스트 비움
                    }
                    if (unit.is_disabled === true || unit.is_disabled === "TRUE") {
                        td.classList.add('disabled');
                    }

                    // 병합 처리 (rowSpan / colSpan)
                    const rs = Number(unit.row_span) || 1;
                    const cs = Number(unit.col_span) || 1;

                    if (rs > 1) td.rowSpan = rs;
                    if (cs > 1) td.colSpan = cs;
                    if (rs > 1 || cs > 1) td.classList.add('merged');

                    // [중요] 병합된 영역만큼 visited 배열에 마킹하여 중복 생성 방지
                    for (let i = 0; i < rs; i++) {
                        for (let j = 0; j < cs; j++) {
                            if (i === 0 && j === 0) continue; // 자기 자신은 제외
                            const tf = f - i; 
                            const tl = l + j;
                            if (tf >= 1 && tl <= maxLine) {
                                visited[tf][tl] = true; // 이곳은 그리지 말라고 표시
                            }
                        }
                    }
                } else {
                    // 데이터가 없는 빈 셀 (기본값)
                    // 호수 자동 생성 규칙 적용 (예: 501)
                    const lineStr = l < 10 ? `0${l}` : `${l}`;
                    td.textContent = `${f}${lineStr}`;
                    td.dataset.ho = `${f}${lineStr}`;
                }

                tr.appendChild(td);
            }
            table.appendChild(tr);
        }

        this.container.appendChild(table);
        this.table = table;

        // 이벤트 리스너 다시 연결 (부모 클래스 메서드 활용)
        this.reattachEvents();
        
        // 히스토리 초기화 (불러온 직후는 Undo 불가)
        this.historyStack = [];
    }

    cleanupMergedCells(units) {
        // units 데이터에 row_span/col_span 정보가 있으므로 이를 활용
        const unitMap = new Map();
        units.forEach(u => unitMap.set(`${u.floor}_${u.line}`, u));

        // 다시 순회하면서, 병합된 영역에 포함되는지 확인하는 것은 복잡하므로
        // 간단히 "createGrid가 만든 셀" 중 "데이터(unit)가 없는 좌표"는 삭제된 셀로 간주하거나
        // 병합 로직을 다시 적용해야 함.
        
        // 여기서는 가장 확실한 방법: createGrid로 만든 table을 기반으로
        // 병합 정보를 다시 적용하여 가려질 셀을 숨김 (VisualGenerator의 mergeCells 로직 활용 불가하므로 수동 처리)
        
        const visited = new Set(); // 이미 처리된(보여지는) 셀들

        // ... (복잡한 병합 복구 로직 생략하고 CSS로 가려진 셀 처리) ...
        // 팁: 이미 rowSpan이 적용된 상태에서 HTML 테이블 렌더링 시, 
        // 브라우저가 알아서 밀어내기 때문에 "밀려난 셀"을 제거해야 모양이 맞음.
        
        // [해결책] : renderFromData에서 createGrid를 호출하지 말고, 
        // 데이터를 기반으로 TR/TD를 직접 생성하는 것이 더 안전함. 
        // 하지만 기존 구조 유지를 위해, createGrid 직후 rowSpan 적용 시
        // "겹치는 위치의 TD"를 DOM에서 제거하는 로직을 추가합니다.

        // (이 부분은 너무 길어지므로 일단 기본 렌더링만 확인하시고, 
        //  병합이 깨진다면 Editor에서는 병합을 풀고 보여주는 것이 수정하기에 더 편할 수 있습니다.)
    }

    /**
     * 구조 변경 (층/라인 수정) 적용
     */
    applyStructureChange(newFloor, newLine) {
        if(!this.siteName) return;
        const currentData = this.exportData(this.siteName, this.dongName);
        
        // 새 그리드 생성
        this.createGrid(newFloor, newLine);
        
        // 3. 기존 데이터 좌표 매칭하여 복구
        // 좌표(층/라인)가 겹치는 데이터만 살아남고, 범위를 벗어난 데이터는 삭제됨
        const unitMap = new Map();
        currentEditData.forEach(u => unitMap.set(`${u.floor}_${u.line}`, u));

        const rows = this.table.querySelectorAll('tr');
        rows.forEach(tr => {
            tr.querySelectorAll('td').forEach(td => {
                const f = parseInt(td.dataset.floor);
                const l = parseInt(td.dataset.line);
                const unit = unitMap.get(`${f}_${l}`);
                
                if (unit) {
                    td.textContent = unit.ho;
                    td.dataset.ho = unit.ho;
                    if(unit.type) td.dataset.type = unit.type;
                    if(unit.is_void) td.classList.add('void');
                    if(unit.is_disabled) td.classList.add('disabled');
                    // 병합은 구조 변경 시 깨질 위험이 크므로 해제하는 것이 안전함
                    // (사용자가 다시 병합하도록 유도)
                }
            });
        });
        
        alert("구조가 변경되었습니다. (좌표가 벗어난 데이터는 삭제되었으며, 병합은 초기화되었습니다)");
    }
}