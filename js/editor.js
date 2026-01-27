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
        
        // 기존 옵션 초기화 (첫 번째 '선택하세요'만 남김)
        selectElement.innerHTML = '<option value="">동 선택...</option>';

        if(res.result === 'success') {
            res.data.forEach(item => {
                const opt = document.createElement('option');
                // value에 객체를 문자열로 저장하여 나중에 쉽게 파싱
                opt.value = JSON.stringify(item); 
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
        
        // UI에 현장명/동 표시 (읽기 전용)
        document.getElementById('edit-site-display').value = this.siteName;
        document.getElementById('edit-dong-display').value = this.dongName;

        // 서버에서 데이터 조회
        const res = await SheetAPI.action('read_dong_detail', { site_name: site, dong: dong });
        if(res.result !== 'success') {
            alert("데이터를 불러오는데 실패했습니다: " + res.message);
            return;
        }

        this.currentData = res.data;
        this.renderFromData(this.currentData);
    }

    /**
     * DB 데이터를 기반으로 그리드 복원
     */
    renderFromData(units) {
        if (!units || units.length === 0) return;

        // 1. 최대 층/라인 계산하여 그리드 틀 생성
        const maxFloor = Math.max(...units.map(u => u.floor));
        const maxLine = Math.max(...units.map(u => u.line));
        
        // 입력창 동기화
        document.getElementById('edit-floor').value = maxFloor;
        document.getElementById('edit-line').value = maxLine;

        // 2. 빈 테이블 생성 (부모 클래스 메서드 사용)
        this.createGrid(maxFloor, maxLine); 

        // 3. 데이터 매핑용 맵 생성
        const unitMap = new Map();
        units.forEach(u => unitMap.set(`${u.floor}_${u.line}`, u));

        // 4. 각 셀에 속성(타입, 상태, 병합 등) 복구
        const rows = this.table.querySelectorAll('tr');
        rows.forEach(tr => {
            const cells = tr.querySelectorAll('td');
            cells.forEach(td => {
                const f = parseInt(td.dataset.floor);
                const l = parseInt(td.dataset.line);
                const unit = unitMap.get(`${f}_${l}`);
                
                if (unit) {
                    // 기본 텍스트 및 데이터셋 복구
                    td.textContent = unit.ho;
                    td.dataset.ho = unit.ho; // 명칭이 변경되었을 수 있음
                    if(unit.type) td.dataset.type = unit.type;
                    
                    // 상태 클래스 복구
                    if(unit.is_void) {
                        td.classList.add('void');
                        td.textContent = '';
                    }
                    if(unit.is_disabled) td.classList.add('disabled');
                    
                    // 병합 처리 복구
                    // DB에는 row_span이 저장되어 있음
                    if(unit.row_span > 1) td.rowSpan = unit.row_span;
                    if(unit.col_span > 1) td.colSpan = unit.col_span;
                    
                    // 병합된 셀(Head)이라면 클래스 추가
                    if(unit.row_span > 1 || unit.col_span > 1) {
                        td.classList.add('merged');
                    }
                }
            });
        });

        // 5. 병합으로 인해 가려져야 할 셀들 숨김 처리 (Clean up)
        // (간단하게: createGrid는 모든 셀을 생성하므로, 병합된 영역에 포함되는 셀을 찾아 숨겨야 함)
        // 여기서는 VisualGenerator의 mergeCells 로직을 직접 호출하지 않고, 
        // 데이터 기반으로 이미 rowSpan이 설정되었으므로, 가려질 셀들만 display:none 처리
        
        // 다시 순회하며 숨김 처리
        rows.forEach(tr => {
            Array.from(tr.children).forEach(td => {
                const f = parseInt(td.dataset.floor);
                const l = parseInt(td.dataset.line);
                
                // 현재 셀이 누군가의 병합 영역에 포함되는지 확인
                // (이 로직은 복잡할 수 있으므로, 간편하게 'DB에서 병합된 셀은 가져오지 않는 방식'이 아니라면
                //  UI상에서 겹치는 부분을 지워야 함)
                
                // 팁: HTML Table 렌더링 시 rowSpan이 적용되면 그 자리에 있는 다음 셀들은 밀려납니다.
                // 따라서 createGrid로 꽉 찬 테이블을 만든 뒤 rowSpan을 적용하면 테이블이 깨집니다.
                // 해결책: rowSpan이 적용된 위치의 '가려질 셀'들을 DOM에서 제거해야 합니다.
            });
        });

        // [중요] 병합된 테이블을 완벽히 복구하기 위해 
        // "병합된 셀의 영향 범위에 있는 셀 삭제" 로직 실행
        this.cleanupMergedCells();
    }

    /**
     * rowSpan/colSpan이 설정된 셀들에 의해 가려져야 할 셀들을 제거
     */
    cleanupMergedCells() {
        // 위에서부터 순회하며 병합 정보를 확인
        const cellsToRemove = [];
        const rows = this.table.querySelectorAll('tr');
        
        // 2차원 배열처럼 접근하기 위해 매핑
        // 하지만 DOM 조작이 복잡하므로, 가장 확실한 방법은 
        // VisualGenerator의 mergeCells 로직을 활용하는 것이지만, 
        // 여기서는 이미 rowSpan이 박혀있으므로 HTML Table 특성상 밀려난 셀들을 지워야 함.
        
        // 간단한 해결책: DB에 저장할 때 'merged=true'(숨겨진 셀) 정보를 저장했음.
        // 따라서 그 정보를 기반으로 숨기면 됨.
        
        const unitMap = new Map();
        this.currentData.forEach(u => unitMap.set(`${u.floor}_${u.line}`, u));

        rows.forEach(tr => {
            tr.querySelectorAll('td').forEach(td => {
                const f = parseInt(td.dataset.floor);
                const l = parseInt(td.dataset.line);
                
                // DB상에 해당 좌표 데이터가 없거나(그럴린 없지만), 
                // 해당 좌표가 병합되어 숨겨진 셀인지 확인해야 함.
                // 하지만 현재 DB 구조상 is_merged 필드가 명시적으로 없어서(merged 셀은 저장 안 함 or status로 구분?),
                // generator.js의 exportData를 보면 `cell.dataset.merged === "true"`인 셀은 저장을 안 하거나(skip),
                // 저장하더라도 식별자가 필요함.
                
                // *수정 제안*: Code.gs/Generator.js 확인 결과, 병합되어 숨겨진 셀은 `units` 배열에 포함되지 않음(exportData에서 skip).
                // 따라서 unitMap.get() 결과가 없는 셀은 "병합되어 사라진 셀"로 간주하고 삭제하면 됨.
                
                const unit = unitMap.get(`${f}_${l}`);
                if (!unit) {
                    td.style.display = 'none'; // 혹은 td.remove();
                }
            });
        });
    }

    /**
     * 구조 변경 (층/라인 수정) 적용
     */
    applyStructureChange(newFloor, newLine) {
        // 1. 현재 화면의 데이터를 추출 (수정 중이던 내용 보존)
        // 주의: exportData는 siteName, dongName이 필요
        const currentEditData = this.exportData(this.siteName, this.dongName);
        
        // 2. 그리드 새로 생성 (크기 변경)
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