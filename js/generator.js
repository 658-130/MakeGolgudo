/**
 * 골구도 생성 및 편집을 담당하는 클래스
 * - 기능: 그리드 생성, 드래그 선택, 병합, 활성/비활성 토글, 데이터 추출
 */
export class VisualGenerator {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.table = null;
    this.isDragging = false;
    this.startCell = null; // 드래그 시작 셀
    this.selectedCells = []; // 현재 선택된 셀 목록
  }

  /**
   * 1. 초기 그리드 생성 (동작 초기화)
   * @param {number} maxFloor 최고 층수
   * @param {number} maxLine 라인 수
   */
  createGrid(maxFloor, maxLine) {
    this.container.innerHTML = ''; // 초기화
    this.table = document.createElement('table');
    this.table.className = 'grid-table';

    // 드래그 중 텍스트 선택 방지
    this.table.style.userSelect = 'none';

    // 마우스 이벤트 리스너 (이벤트 위임)
    this.table.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.table.addEventListener('mouseover', (e) => this.onMouseOver(e));
    this.table.addEventListener('mouseup', () => this.onMouseUp());
    // 테이블 밖으로 나갔을 때 드래그 종료 처리
    document.addEventListener('mouseup', () => (this.isDragging = false));

    // 층수 역순 생성 (Top -> Bottom)
    for (let f = maxFloor; f >= 1; f--) {
      const tr = document.createElement('tr');
      for (let l = 1; l <= maxLine; l++) {
        const td = document.createElement('td');

        // 데이터 속성 주입
        td.dataset.floor = f;
        td.dataset.line = l;
        td.dataset.ho = `${f}${l.toString().padStart(2, '0')}`; // 예: 1504
        td.dataset.active = "true"; // 기본값 활성
        td.dataset.merged = "false"; // 병합되어 숨겨진 상태인지

        // 화면 표시 텍스트
        td.textContent = td.dataset.ho;
        td.className = 'grid-cell';

        tr.appendChild(td);
      }
      this.table.appendChild(tr);
    }
    this.container.appendChild(this.table);
  }

  /**
   * 2. 마우스 이벤트 핸들러 (드래그 선택 로직)
   */
  onMouseDown(e) {
    if (e.target.tagName !== 'TD') return;
    this.isDragging = true;
    this.clearSelection(); // 기존 선택 초기화
    this.startCell = e.target;
    this.selectRange(this.startCell, e.target);
  }

  onMouseOver(e) {
    if (!this.isDragging || e.target.tagName !== 'TD') return;
    this.selectRange(this.startCell, e.target);
  }

  onMouseUp() {
    this.isDragging = false;
  }

  // 시작 셀과 끝 셀 사이의 직사각형 영역 선택
  selectRange(start, end) {
    // 기존 선택 스타일 제거
    this.selectedCells.forEach(cell => cell.classList.remove('selected'));
    this.selectedCells = [];

    const startF = parseInt(start.dataset.floor);
    const startL = parseInt(start.dataset.line);
    const endF = parseInt(end.dataset.floor);
    const endL = parseInt(end.dataset.line);

    // 범위 계산 (Math.min/max로 드래그 방향 상관없이 처리)
    const minF = Math.min(startF, endF);
    const maxF = Math.max(startF, endF);
    const minL = Math.min(startL, endL);
    const maxL = Math.max(startL, endL);

    // 범위 내 셀 찾기
    const cells = this.table.querySelectorAll('td');
    cells.forEach(cell => {
      const f = parseInt(cell.dataset.floor);
      const l = parseInt(cell.dataset.line);

      // 병합되어 숨겨진 셀(display:none)은 선택 대상에서 제외 가능하나, 로직상 포함 후 처리
      if (f >= minF && f <= maxF && l >= minL && l <= maxL) {
        if (cell.style.display !== 'none') {
          cell.classList.add('selected');
          this.selectedCells.push(cell);
        }
      }
    });
  }

  clearSelection() {
    this.selectedCells.forEach(cell => cell.classList.remove('selected'));
    this.selectedCells = [];
  }

  /**
   * 3. 액션 기능 (병합, 활성/비활성 토글)
   */

  // 선택된 셀 병합 (펜트하우스 만들기)
  mergeCells() {
    if (this.selectedCells.length < 2) {
      alert("병합하려면 2개 이상의 셀을 선택하세요.");
      return;
    }

    // 좌상단(Top-Left) 셀 찾기 (Master Cell)
    // 층수는 높을수록 위쪽이므로 maxFloor가 Top
    const floors = this.selectedCells.map(c => parseInt(c.dataset.floor));
    const lines = this.selectedCells.map(c => parseInt(c.dataset.line));

    const topFloor = Math.max(...floors);
    const leftLine = Math.min(...lines);
    const bottomFloor = Math.min(...floors);
    const rightLine = Math.max(...lines);

    // Master Cell 식별
    const masterCell = this.selectedCells.find(
      c => parseInt(c.dataset.floor) === topFloor && parseInt(c.dataset.line) === leftLine
    );

    if (!masterCell) return;

    // Span 계산
    const rowSpan = (topFloor - bottomFloor) + 1;
    const colSpan = (rightLine - leftLine) + 1;

    // DOM 업데이트
    masterCell.rowSpan = rowSpan;
    masterCell.colSpan = colSpan;
    masterCell.classList.add('merged');
    masterCell.textContent += ` (PH)`; // 표시 갱신

    // 나머지 셀 숨김 처리
    this.selectedCells.forEach(cell => {
      if (cell !== masterCell) {
        cell.style.display = 'none';
        cell.dataset.merged = "true"; // 데이터 추출 시 무시용
      }
    });

    this.clearSelection();
  }

  // 선택된 셀 활성/비활성 토글 (X 표시)
  toggleActiveState() {
    if (this.selectedCells.length === 0) return;

    const isAllInactive = this.selectedCells.every(c => c.dataset.active === "false");
    const newState = isAllInactive ? "true" : "false"; // 전부 비활성이면 활성으로, 아니면 비활성으로

    this.selectedCells.forEach(cell => {
      cell.dataset.active = newState;
      if (newState === "false") {
        cell.classList.add('inactive'); // CSS로 회색/X표시 처리
      } else {
        cell.classList.remove('inactive');
      }
    });

    this.clearSelection();
  }

  /**
   * 4. 데이터 추출 (JSON 변환)
   * - 화면에 보이는 그대로 데이터를 만들어 리턴
   */
  exportData(dongName) {
    const units = [];
    const allCells = this.table.querySelectorAll('td');

    allCells.forEach(cell => {
      // 병합되어 숨겨진 셀은 데이터 생성 안 함 (Master Cell에 정보 포함됨)
      if (cell.dataset.merged === "true") return;

      // 비활성(X) 셀은 저장할지 말지 정책 결정. 
      // 보통 DB에는 남기되 active=false로 저장하는 것이 좋음.

      units.push({
        unique_id: `${dongName}_${cell.dataset.ho}`,
        dong: dongName,
        floor: parseInt(cell.dataset.floor),
        line: parseInt(cell.dataset.line),
        ho: cell.dataset.ho,
        type: cell.classList.contains('merged') ? 'PH' : 'Default', // 펜트하우스 타입 자동 지정
        row_span: cell.rowSpan,
        col_span: cell.colSpan,
        is_active: cell.dataset.active === "true",
        status: 'before', // 초기값
        items: '{}',
        remark: ''
      });
    });

    return units;
  }
}