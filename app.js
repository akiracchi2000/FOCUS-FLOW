// Selector constants
const todoInput = document.getElementById('todo-input');
const todoDate = document.getElementById('todo-date');
const todoPriority = document.getElementById('todo-priority');
const todoRepeatBtn = document.getElementById('todo-repeat');
const todoList = document.getElementById('todo-list');
const itemsLeft = document.getElementById('items-left');
const filterBtns = document.querySelectorAll('.filter-btn');
const clearCompletedBtn = document.getElementById('clear-completed');
const themeToggleBtn = document.getElementById('theme-toggle');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importInput = document.getElementById('import-input');
const sortDateBtn = document.getElementById('sort-date');
const sortPriorityBtn = document.getElementById('sort-priority');
const searchInput = document.getElementById('search-input');

// Modal Selectors
const editModal = document.getElementById('edit-modal');
const editText = document.getElementById('edit-text');
const editDate = document.getElementById('edit-date');
const editPriority = document.getElementById('edit-priority');
const saveEditBtn = document.getElementById('save-edit');
const cancelEditBtn = document.getElementById('cancel-edit');
const subtaskList = document.getElementById('subtaskList');
const newSubtaskInput = document.getElementById('newSubtaskInput');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');

// State
let todos = JSON.parse(localStorage.getItem('myPremiumTodos')) || [];
let currentFilter = 'all';
let searchQuery = '';
let editingId = null;
let editingSubtasks = [];
let isRecurring = false;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderTodos();
    loadTheme();
});

// Theme Logic
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
}

function updateThemeIcon(isDark) {
    const icon = themeToggleBtn.querySelector('i');
    if (isDark) {
        icon.classList.remove('ph-moon');
        icon.classList.add('ph-sun');
    } else {
        icon.classList.remove('ph-sun');
        icon.classList.add('ph-moon');
    }
}

themeToggleBtn.addEventListener('click', toggleTheme);

// Backup Logic
exportBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(todos, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focus-flow-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

importBtn.addEventListener('click', () => {
    importInput.click();
});

importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (!Array.isArray(parsedData)) throw new Error('Invalid format');

            if (confirm('Importing will overwrite your current tasks. Are you sure?')) {
                todos = parsedData;
                saveAndRender();
                alert('Data imported successfully!');
            }
        } catch (error) {
            alert('Failed to import: Invalid JSON file.');
            console.error(error);
        }
        // Reset input so same file can be selected again if needed
        importInput.value = '';
    };
    reader.readAsText(file);
});

// Search Logic
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTodos();
});

// Sorting Logic
function sortByDate() {
    todos.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
    saveAndRender();
}

function sortByPriority() {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    todos.sort((a, b) => {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
    });
    saveAndRender();
}

sortDateBtn.addEventListener('click', sortByDate);
sortPriorityBtn.addEventListener('click', sortByPriority);

// Drag and Drop Logic
function enableDragAndDrop() {
    const draggables = document.querySelectorAll('.todo-item');
    const container = document.getElementById('todo-list');

    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });

        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
            updateOrder();
        });
    });

    let currentAfterElement = null;

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');

        // Only update if position actually changed to prevent constant firing
        if (afterElement !== currentAfterElement) {
            currentAfterElement = afterElement;

            // FLIP Animation Start
            const siblings = [...container.querySelectorAll('.todo-item:not(.dragging)')];
            const positions = new Map();
            siblings.forEach(el => positions.set(el, el.getBoundingClientRect().top));

            // Change DOM
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }

            // FLIP Animation End
            siblings.forEach(el => {
                const oldTop = positions.get(el);
                const newTop = el.getBoundingClientRect().top;
                const diff = oldTop - newTop;

                if (diff !== 0) {
                    el.style.transition = 'none';
                    el.style.transform = `translateY(${diff}px)`;

                    // Force reflow
                    void el.offsetHeight;

                    el.style.transition = 'transform 0.5s cubic-bezier(0.2, 0, 0, 1)';
                    el.style.transform = '';
                }
            });
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.todo-item:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateOrder() {
    const newOrderIds = [...document.querySelectorAll('.todo-item')].map(item => Number(item.dataset.id));
    // Reorder todos array based on DOM order
    todos = newOrderIds.map(id => todos.find(todo => todo.id === id));
    saveAndRender();
}

// Event Listeners
// Allow Enter key on all inputs in the group
[todoInput, todoDate, todoPriority].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
});

todoRepeatBtn.addEventListener('click', () => {
    isRecurring = !isRecurring;
    todoRepeatBtn.classList.toggle('active', isRecurring);
});

clearCompletedBtn.addEventListener('click', clearCompleted);

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Handle filter button logic (except clear completed)
        if (btn.id === 'clear-completed') return;

        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTodos();
    });
});

// Modal Event Listeners
saveEditBtn.addEventListener('click', saveEdit);
addSubtaskBtn.addEventListener('click', addModalSubtask);
newSubtaskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addModalSubtask();
});
subtaskList.addEventListener('click', (e) => {
    if (e.target.closest('.subtask-delete-btn')) {
        const btn = e.target.closest('.subtask-delete-btn');
        const id = Number(btn.dataset.id);
        deleteModalSubtask(id);
    }
});
cancelEditBtn.addEventListener('click', closeEditModal);
editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
});

// Functions
function addTodo() {
    const text = todoInput.value.trim();
    const date = todoDate.value;
    const priority = todoPriority.value;
    if (text === '') return;

    const newTodo = {
        id: Date.now(),
        text: text,
        dueDate: date,
        priority: priority,
        text: text,
        dueDate: date,
        priority: priority,
        completed: false,
        subtasks: [],
        recurring: isRecurring
    };

    todos.unshift(newTodo); // Add to top
    saveAndRender();
    todoInput.value = '';
    todoDate.value = '';
    updateDateTriggerState(); // Reset date trigger visual
    todoPriority.value = 'medium'; // Reset to default

    // Reset recurring state
    isRecurring = false;
    todoRepeatBtn.classList.remove('active');

    todoInput.focus();
}

// Date Trigger Logic
const dateTrigger = document.getElementById('date-trigger');
const addBtn = document.getElementById('add-btn');

todoDate.addEventListener('change', updateDateTriggerState);
addBtn.addEventListener('click', addTodo);

function updateDateTriggerState() {
    if (todoDate.value) {
        dateTrigger.classList.add('has-date');
        // Optional: Tooltip update
        dateTrigger.title = `Due: ${todoDate.value}`;
    } else {
        dateTrigger.classList.remove('has-date');
        dateTrigger.title = 'Set Due Date';
    }
}

function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    if (todo.recurring && !todo.completed) {
        // Recurring task logic: Schedule for tomorrow instead of completing
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // Format as YYYY-MM-DD
        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');

        todo.dueDate = `${yyyy}-${mm}-${dd}`;
        // Brief animation or simple update? for simplicity just update.
        // Maybe move to top if date changed?
        todos.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        // Don't mark as completed, stay active
        saveAndRender();
    } else {
        // Normal behavior
        todos = todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed } : t
        );
        saveAndRender();
    }
}

function deleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;

    const item = document.querySelector(`[data-id="${id}"]`);
    if (item) {
        item.style.animation = 'fadeOut 0.3s ease-out forwards';
        item.addEventListener('animationend', () => {
            todos = todos.filter(todo => todo.id !== id);
            saveAndRender();
        });
    } else {
        todos = todos.filter(todo => todo.id !== id);
        saveAndRender();
    }
}

function clearCompleted() {
    if (!confirm('Are you sure you want to delete ALL completed tasks?')) return;

    todos = todos.filter(todo => !todo.completed);
    saveAndRender();
}

function saveAndRender() {
    localStorage.setItem('myPremiumTodos', JSON.stringify(todos));
    renderTodos();
}

function openEditModal(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    editingId = id;
    editText.value = todo.text;
    editDate.value = todo.dueDate || '';
    editPriority.value = todo.priority || 'medium';

    // Deep copy subtasks
    editingSubtasks = JSON.parse(JSON.stringify(todo.subtasks || []));
    renderModalSubtasks();

    editModal.classList.remove('hidden');
    editText.focus();
}

function closeEditModal() {
    editModal.classList.add('hidden');
    editingId = null;
}

function saveEdit() {
    if (!editingId) return;

    const newText = editText.value.trim();
    if (newText === '') return;

    todos = todos.map(todo =>
        todo.id === editingId
            ? {
                ...todo,
                text: newText,
                dueDate: editDate.value,
                priority: editPriority.value,
                subtasks: editingSubtasks
            }
            : todo
    );

    saveAndRender();
    closeEditModal();
}

function renderTodos() {
    todoList.innerHTML = '';

    // Filter logic
    const filteredTodos = todos.filter(todo => {
        // Status Filter
        let matchesStatus = true;

        if (currentFilter === 'today') {
            if (!todo.dueDate) {
                matchesStatus = false;
            } else {
                const date = new Date(todo.dueDate);
                const today = new Date();

                // Compare YYYY-MM-DD
                date.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);

                matchesStatus = date.getTime() === today.getTime() && !todo.completed;
            }
        } else {
            matchesStatus =
                (currentFilter === 'active' && !todo.completed) ||
                (currentFilter === 'completed' && todo.completed) ||
                (currentFilter === 'all');
        }

        // Search Filter
        const matchesSearch = todo.text.toLowerCase().includes(searchQuery);

        return matchesStatus && matchesSearch;
    });

    // Update counts
    const activeCount = todos.filter(t => !t.completed).length; // Count based on ALL todos, not filtered
    itemsLeft.innerText = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;

    // Generate HTML
    filteredTodos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id; // For DnD
        li.draggable = true; // Enable Drag
        li.style.animationDelay = `${index * 0.05}s`; // Staggered animation

        // Priority indicator
        let priorityHtml = '';
        if (todo.priority === 'high') priorityHtml = '<span class="priority-indicator priority-high">High</span>';
        else if (todo.priority === 'medium') priorityHtml = '<span class="priority-indicator priority-medium">Medium</span>';
        else if (todo.priority === 'low') priorityHtml = '<span class="priority-indicator priority-low">Low</span>';

        // Recurring Icon
        const recurringHtml = todo.recurring
            ? '<i class="ph ph-arrows-clockwise recurring-icon" title="Daily Habit"></i>'
            : '';

        const dateInfo = formatDueDate(todo.dueDate);
        const dateHtml = todo.dueDate
            ? `<span class="todo-date"><i class="ph ph-calendar-blank"></i> ${dateInfo.text}</span>`
            : '';

        if (dateInfo.class) {
            li.classList.add(dateInfo.class);
        }

        // Subtasks HTML
        let subtasksHtml = '';
        if (todo.subtasks && todo.subtasks.length > 0) {
            subtasksHtml = '<div class="todo-subtasks">';
            todo.subtasks.forEach(sub => {
                subtasksHtml += `
                    <div class="subtask-display-item ${sub.completed ? 'completed' : ''}" data-subtask-id="${sub.id}" data-parent-id="${todo.id}">
                        <div class="subtask-check-circle">
                             <i class="ph ph-check"></i>
                        </div>
                        <span class="subtask-content">${escapeHtml(sub.text)}</span>
                    </div>
                `;
            });
            subtasksHtml += '</div>';
        }

        li.innerHTML = `
            <div class="check-circle">
                <i class="ph ph-check"></i>
            </div>
            <div class="todo-content">
                <div class="todo-header">
                    ${recurringHtml}
                    ${priorityHtml}
                    <span class="todo-text">${escapeHtml(todo.text)}</span>
                </div>
                ${dateHtml}
                ${subtasksHtml}
            </div>
            <button class="delete-btn" aria-label="Delete Task">
                <i class="ph ph-trash"></i>
            </button>
        `;

        // Event Delegation within LI

        // Check circle click -> Toggle Complete
        const checkCircle = li.querySelector('.check-circle');
        checkCircle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTodo(todo.id);
        });

        // Content click -> Open Edit Modal
        const contentDiv = li.querySelector('.todo-content');
        contentDiv.addEventListener('click', (e) => {
            openEditModal(todo.id);
        });

        // Delete button click
        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent modal opening
            deleteTodo(todo.id);
        });

        // Subtask click -> Toggle
        const subtaskItems = li.querySelectorAll('.subtask-display-item');
        subtaskItems.forEach(subItem => {
            subItem.addEventListener('click', (e) => {
                e.stopPropagation();
                const subId = Number(subItem.dataset.subtaskId);
                const parentId = Number(subItem.dataset.parentId);
                toggleSubtask(parentId, subId);
            });
        });

        todoList.appendChild(li);
    });

    // Re-enable Drag and Drop after rendering
    enableDragAndDrop();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDueDate(dateString) {
    if (!dateString) return { text: '', class: '' };

    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Reset hours to compare just the date part
    date.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);

    if (date.getTime() === today.getTime()) {
        return { text: 'TODAY', class: 'date-today' };
    } else if (date.getTime() === tomorrow.getTime()) {
        return { text: 'TOMORROW', class: 'date-tomorrow' };
    } else {
        return { text: dateString, class: '' };
    }
}

// Subtask Functions
function toggleSubtask(todoId, subtaskId) {
    const todo = todos.find(t => t.id === todoId);
    if (todo && todo.subtasks) {
        todo.subtasks = todo.subtasks.map(sub =>
            sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
        );
        saveAndRender();
    }
}

function renderModalSubtasks() {
    subtaskList.innerHTML = '';
    editingSubtasks.forEach(sub => {
        const li = document.createElement('li');
        li.className = 'subtask-item-modal';
        li.innerHTML = `
            <span class="subtask-text">${escapeHtml(sub.text)}</span>
            <button class="subtask-delete-btn" data-id="${sub.id}">
                <i class="ph ph-trash"></i>
            </button>
        `;
        subtaskList.appendChild(li);
    });
}

function addModalSubtask() {
    const text = newSubtaskInput.value.trim();
    if (text === '') return;

    const newSubtask = {
        id: Date.now(),
        text: text,
        completed: false
    };

    editingSubtasks.push(newSubtask);
    renderModalSubtasks();
    newSubtaskInput.value = '';
    newSubtaskInput.focus();
}

function deleteModalSubtask(id) {
    editingSubtasks = editingSubtasks.filter(sub => sub.id !== id);
    renderModalSubtasks();
}
