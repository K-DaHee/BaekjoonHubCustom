/**
 * PR body 입력을 위한 커스텀 모달
 * prompt() 대화상자를 대체하여 하나의 모달에서 모든 필드를 입력받습니다.
 * 
 * @example
 * const result = await showPRBodyModal([
 *   { id: 'approach', label: '🤔 접근 방법', type: 'textarea', placeholder: '어떻게 접근했나요?' },
 *   { id: 'difficulty', label: '🤯 어려웠던 점', type: 'textarea', placeholder: '어떤 점이 어려웠나요?' },
 *   { id: 'learned', label: '📚 배운 점', type: 'textarea', placeholder: '무엇을 배웠나요?' },
 * ]);
 * // result: { approach: '...', difficulty: '...', learned: '...' } 또는 null (취소 시)
 */

/**
 * 커스텀 모달을 표시하고 사용자 입력을 Promise로 반환합니다.
 * @param {Array<{id: string, label: string, type?: string, placeholder?: string}>} fields - 입력 필드 배열
 * @param {string} [title='📝 풀이 기록'] - 모달 제목
 * @returns {Promise<Object|null>} - 입력값 객체 또는 취소 시 null
 */
function showPRBodyModal(fields, title = '📝 풀이 기록') {
    return new Promise((resolve) => {
        // 기존 모달이 있으면 제거
        const existingModal = document.getElementById('bjh-modal-overlay');
        if (existingModal) existingModal.remove();

        // 오버레이 생성
        const overlay = document.createElement('div');
        overlay.id = 'bjh-modal-overlay';
        overlay.className = 'bjh-modal-overlay';

        // 모달 카드 생성
        const modal = document.createElement('div');
        modal.className = 'bjh-modal';

        // 제목
        const titleEl = document.createElement('h2');
        titleEl.className = 'bjh-modal-title';
        titleEl.textContent = title;
        modal.appendChild(titleEl);

        // 부제목
        const subtitle = document.createElement('p');
        subtitle.className = 'bjh-modal-subtitle';
        subtitle.textContent = '비워두면 기본값으로 저장됩니다. "-" 입력 시 해당 항목을 생략합니다.';
        modal.appendChild(subtitle);

        // 입력 필드 생성
        fields.forEach((field, index) => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'bjh-modal-field';

            const label = document.createElement('label');
            label.className = 'bjh-modal-label';
            label.textContent = field.label;
            label.setAttribute('for', `bjh-field-${field.id}`);
            fieldDiv.appendChild(label);

            let input;
            if (field.type === 'input') {
                // 한 줄 입력 (예: 알고리즘 분류)
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'bjh-modal-input';
            } else {
                // 여러 줄 입력 (기본값: textarea)
                input = document.createElement('textarea');
                input.className = 'bjh-modal-textarea';
                input.rows = 3;
            }

            input.id = `bjh-field-${field.id}`;
            input.placeholder = field.placeholder || '';
            fieldDiv.appendChild(input);

            modal.appendChild(fieldDiv);

            // 첫 번째 필드에 자동 포커스
            if (index === 0) {
                setTimeout(() => input.focus(), 100);
            }
        });

        // 버튼 영역
        const buttons = document.createElement('div');
        buttons.className = 'bjh-modal-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'bjh-modal-btn bjh-modal-btn-cancel';
        cancelBtn.textContent = '취소';
        cancelBtn.type = 'button';

        const submitBtn = document.createElement('button');
        submitBtn.className = 'bjh-modal-btn bjh-modal-btn-submit';
        submitBtn.textContent = '제출';
        submitBtn.type = 'button';

        buttons.appendChild(cancelBtn);
        buttons.appendChild(submitBtn);
        modal.appendChild(buttons);

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // 결과 수집 함수
        function collectResults() {
            const result = {};
            fields.forEach((field) => {
                const input = document.getElementById(`bjh-field-${field.id}`);
                result[field.id] = input ? input.value : '';
            });
            return result;
        }

        // 모달 닫기
        function closeModal(result) {
            overlay.remove();
            resolve(result);
        }

        // 이벤트 리스너
        submitBtn.addEventListener('click', () => {
            closeModal(collectResults());
        });

        cancelBtn.addEventListener('click', () => {
            closeModal(null);
        });

        // 오버레이 클릭으로 닫기 (모달 바깥)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(null);
            }
        });

        // ESC 키로 닫기
        function handleKeydown(e) {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleKeydown);
                closeModal(null);
            }
        }
        document.addEventListener('keydown', handleKeydown);
    });
}

/**
 * 모달 입력값을 PR body에 사용할 텍스트로 변환합니다.
 * "-" 입력 시 빈 문자열, 비어있으면 기본값 사용.
 * @param {string} value - 사용자 입력값
 * @param {string} [defaultValue='작성된 내용이 없습니다.'] - 기본값
 * @returns {string} - 변환된 텍스트
 */
function processModalInput(value, defaultValue = '작성된 내용이 없습니다.') {
    if (value === '-') return '';
    if (value === null || value.trim() === '') return defaultValue;
    // 줄바꿈을 마크다운 줄바꿈으로 변환
    return value.replace(/\n/g, '  \n');
}
