// Selector constants
const todoInput = document.getElementById('todo-input');
const todoDate = document.getElementById('todo-date');
const todoPriorityBtn = document.getElementById('todo-priority-btn');
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

// File API Selectors
const fileOpenBtn = document.getElementById('file-open-btn');
const fileSaveAsBtn = document.getElementById('file-save-as-btn');
const fileStatus = document.getElementById('file-status');
const currentFilenameSpan = document.getElementById('current-filename');
const installBtn = document.getElementById('install-btn');

// Modal Selectors
const editModal = document.getElementById('edit-modal');
const editText = document.getElementById('edit-text');
const editDate = document.getElementById('edit-date');
const editDateTrigger = document.getElementById('edit-date-trigger');
const editPriorityBtn = document.getElementById('edit-priority-btn');
const saveEditBtn = document.getElementById('save-edit');
const cancelEditBtn = document.getElementById('cancel-edit');
const subtaskList = document.getElementById('subtaskList');
const newSubtaskInput = document.getElementById('newSubtaskInput');
const addSubtaskBtn = document.getElementById('addSubtaskBtn');

// Firebase Imports Removed for Local Storage
// import { db, collection, addDoc, setDoc, doc, updateDoc, deleteDoc, onSnapshot } from './firebase-config.js';

// State
let todos = []; // Now managed by Firestore listener
let currentFilter = 'all';
let currentSort = 'default'; // default, date, priority
let searchQuery = '';
let editingId = null;
let fileHandle = null; // Reference to the open file

// Collection Reference
// Collection Reference Removed
// const todosCollection = collection(db, "todos");

// --- DEBUG LOGGING ---
// Debug helper - now pointing to console
const logToScreen = (msg) => {
    console.log(msg);
};

// Global Error Handler - Removed for production
// ...
logToScreen("App module loaded.");
logToScreen("Auth Domain: " + (typeof firebaseConfig !== 'undefined' ? firebaseConfig.authDomain : 'Unknown'));

// --- Initialization & Migration ---

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadTodos();
});

// Real-time Listener (Replaces load from localStorage)
// This runs once on load, and then every time data changes on server
// Local Storage Logic
function loadTodos() {
    const saved = localStorage.getItem('myPremiumTodos');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
                todos = parsed;
            } else {
                todos = [];
            }
        } catch (e) {
            console.error('Failed to parse todos', e);
            todos = [];
        }
    }
    applyCurrentSort();
}

async function saveTodos() {
    // 1. Always save to LocalStorage (Backup/Cache)
    localStorage.setItem('myPremiumTodos', JSON.stringify(todos));

    // 2. If fileHandle exists, write to file (Auto-Save)
    if (fileHandle) {
        try {
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(todos, null, 2));
            await writable.close();
        } catch (err) {
            console.error('Auto-save failed:', err);
            // If permission gone, maybe notify? For now, silent fail or log.
            // Possibly reset fileHandle if permission permanently lost?
            // showToast("Auto-save failed!"); // If we had a toast function
        }
    }
}

// --- File System Access API Functions ---

async function openFile() {
    try {
        const [handle] = await window.showOpenFilePicker({
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }],
            multiple: false
        });

        fileHandle = handle;
        const file = await fileHandle.getFile();
        const text = await file.text();

        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
                todos = parsed;
                // Update LocalStorage to match the file we just opened
                saveTodos();
                applyCurrentSort();
                updateFileStatus(file.name);
                alert(`Loaded ${todos.length} tasks from ${file.name}`);
            } else {
                alert('Invalid file format: Not an array of tasks.');
            }
        } catch (parseErr) {
            alert('Error parsing JSON file.');
            console.error(parseErr);
        }

    } catch (err) {
        // User cancelled or browser not supported
        if (err.name !== 'AbortError') {
            console.error('Open file error:', err);
            alert('File open failed. (Browser might not support File System Access API)');
        }
    }
}

async function saveFileAs() {
    try {
        const handle = await window.showSaveFilePicker({
            types: [{
                description: 'JSON Files',
                accept: { 'application/json': ['.json'] }
            }],
            suggestedName: `focus-flow-${new Date().toISOString().split('T')[0]}.json`
        });

        fileHandle = handle;
        // Trigger save immediately
        await saveTodos();

        const file = await fileHandle.getFile();
        updateFileStatus(file.name);
        alert(`Saved to ${file.name}. Future changes will auto-save here.`);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('Save file error:', err);
        }
    }
}

function updateFileStatus(filename) {
    if (filename) {
        fileStatus.style.display = 'inline-block';
        currentFilenameSpan.textContent = filename;
        fileStatus.title = "Auto-saving to: " + filename;
        fileStatus.style.color = 'var(--accent-color)';
    } else {
        fileStatus.style.display = 'none';
        currentFilenameSpan.textContent = 'local storage';
    }
}

fileOpenBtn.addEventListener('click', openFile);
fileSaveAsBtn.addEventListener('click', saveFileAs);


// --- Logic Updates (Firestore Writes) ---

// Sorting Logic (Client-side mainly, though Firestore query sorting is possible)
function sortPinnedFirst(a, b) {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
}

function applyCurrentSort() {
    todos.sort((a, b) => {
        // Always prioritize pinned first
        const pinSort = sortPinnedFirst(a, b);
        if (pinSort !== 0) return pinSort;

        // Then apply specific sort
        if (currentSort === 'date') {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        } else if (currentSort === 'priority') {
            const priorityWeight = { high: 3, medium: 2, low: 1 };
            // If strictly equal, fallback to ID/creation? 
            // Firestore IDs aren't strictly ordered by time unless usually KSUIDs. 
            // We can fallback to 'createdAt' if we had it. 
            // For now, keep existing logic (using 'id' property if it exists, else just string comparison)
            const weightA = priorityWeight[a.priority] || 0;
            const weightB = priorityWeight[b.priority] || 0;
            return weightB - weightA;
        } else {
            // Default: Newest first. 
            // If we migrated, we have numeric IDs. If new, we might rely on a timestamp field 
            // or just the numeric ID we inject.
            // Let's ensure new tasks get a comparable ID or we add a createdAt field.
            return (b.id || 0) - (a.id || 0);
        }
    });
    renderTodos();
}

function sortByDate() {
    currentSort = 'date';
    applyCurrentSort();
}

function sortByPriority() {
    currentSort = 'priority';
    applyCurrentSort();
}

sortDateBtn.addEventListener('click', sortByDate);
sortPriorityBtn.addEventListener('click', sortByPriority);

function togglePin(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    todo.pinned = !todo.pinned;
    saveTodos();
    applyCurrentSort(); // Re-sort to move pinned items
}

// Subtask edit handling
let editingSubtasks = [];
let isRecurring = false;


// Theme Logic (Stays local)
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


// Backup Logic (Exports current local state view)
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

// PWA Install Logic
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    installBtn.style.display = 'inline-flex';
    logToScreen("Available to install!");
});

installBtn.addEventListener('click', async () => {
    // Hide the app provided install promotion
    installBtn.style.display = 'none';
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
});

window.addEventListener('appinstalled', () => {
    // Hide the app-provided install promotion
    installBtn.style.display = 'none';
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    console.log('PWA was installed');
});

importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (!Array.isArray(parsedData)) throw new Error('Invalid format');

            if (confirm('Importing will add these tasks to your list. Continue?')) {
                let count = 0;
                parsedData.forEach(item => {
                    const existingIndex = todos.findIndex(t => t.id === item.id);
                    if (existingIndex !== -1) {
                        todos[existingIndex] = item;
                    } else {
                        todos.push(item);
                    }
                    count++;
                });
                saveTodos();
                applyCurrentSort();
                alert(`Imported ${count} items.`);
            }
        } catch (error) {
            alert('Failed to import: Invalid JSON file.');
            console.error(error);
        }
        importInput.value = '';
    };
    reader.readAsText(file);
});


// Search Logic
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTodos();
});


// Drag and Drop Logic (Visual only, need to persist order?)
// Current logic reorders the array. 
// Persisting order in Firestore usually requires an 'order' field.
// For now, we'll keep the drag/drop visual effect but the "saveAndRender" 
// equivalent needs to update ALL changed docs? That's expensive.
// Let's simplify: DnD updates the 'id' (since we sort by ID for default)? 
// No, mutating IDs is bad.
// Hack for now: We won't persist custom DnD order to cloud in this version 
// unless we add an order field. I will disable the "updateOrder" persistence part
// or just let it update the local view until refresh.
// NOTE: Implementing robust DnD sync is complex (linked lists or fractional indexing).
// I will comment out the persistent save in updateOrder to avoid mass writes.

function enableDragAndDrop() {
    const draggables = document.querySelectorAll('.todo-item');
    const container = document.getElementById('todo-list');

    draggables.forEach(draggable => {
        // Mouse Events
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });

        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
        });

        // Touch Events (Mobile DnD Polyfill-ish logic)
        draggable.addEventListener('touchstart', () => {
            draggable.classList.add('dragging');
            // Add a clearer visual cue for touch drag if needed
        }, { passive: true });

        draggable.addEventListener('touchend', () => {
            draggable.classList.remove('dragging');
            // Remove any temp visual cues
        });
    });

    let currentAfterElement = null;

    // Mouse DragOver
    container.addEventListener('dragover', e => {
        e.preventDefault();
        handleDragMove(container, e.clientY);
    });

    // Touch Move
    container.addEventListener('touchmove', e => {
        e.preventDefault(); // Prevent scrolling while dragging
        const touch = e.touches[0];
        handleDragMove(container, touch.clientY);
    }, { checkFn: null, passive: false }); // explicit non-passive to allow preventDefault
}

function handleDragMove(container, clientY) {
    const afterElement = getDragAfterElement(container, clientY);
    const draggable = document.querySelector('.dragging');

    if (!draggable) return; // Safety check

    // Logic repeated from original dragover, extracted for reuse
    // Note: 'currentAfterElement' logic needs to be inside or accessible. 
    // To keep it clean without scoping issues, we'll simplify and just do the DOM move.
    // The previous animation logic was a bit complex to port cleanly without refactoring validation.
    // Let's rely on standard DOM manipulation for the move itself.

    if (afterElement == null) {
        container.appendChild(draggable);
    } else {
        container.insertBefore(draggable, afterElement);
    }
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

// Event Listeners for Input
[todoInput, todoDate].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
});

// Priority Toggle Logic
todoPriorityBtn.addEventListener('click', () => {
    const current = todoPriorityBtn.dataset.priority;
    let next = 'medium';
    if (current === 'medium') next = 'high';
    else if (current === 'high') next = 'low';
    else if (current === 'low') next = 'medium';

    updatePriorityIcon(next);
});

function updatePriorityIcon(priority) {
    todoPriorityBtn.dataset.priority = priority;
    todoPriorityBtn.title = `Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    const icon = todoPriorityBtn.querySelector('i');
    if (priority === 'high') {
        icon.className = 'ph ph-flag ph-fill';
    } else {
        icon.className = 'ph ph-flag';
    }
}

todoRepeatBtn.addEventListener('click', () => {
    isRecurring = !isRecurring;
    todoRepeatBtn.classList.toggle('active', isRecurring);
});

clearCompletedBtn.addEventListener('click', clearCompleted);

filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
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

// Helper for Edit Modal Priority
function updateEditPriorityIcon(priority) {
    editPriorityBtn.dataset.priority = priority;
    editPriorityBtn.title = `Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}`;
    const icon = editPriorityBtn.querySelector('i');
    if (priority === 'high') {
        icon.className = 'ph ph-flag ph-fill';
    } else {
        icon.className = 'ph ph-flag';
    }
    // Color updates handled by CSS based on data-priority
}

// Helper for Edit Modal Date Trigger
function updateEditDateTriggerState() {
    if (editDate.value) {
        editDateTrigger.classList.add('has-date');
        editDateTrigger.title = `Due: ${editDate.value}`;
    } else {
        editDateTrigger.classList.remove('has-date');
        editDateTrigger.title = 'Set Due Date';
    }
}

// Edit Modal Listeners
editPriorityBtn.addEventListener('click', () => {
    const current = editPriorityBtn.dataset.priority;
    let next = 'medium';
    if (current === 'medium') next = 'high';
    else if (current === 'high') next = 'low';
    else if (current === 'low') next = 'medium';
    updateEditPriorityIcon(next);
});

editDate.addEventListener('change', updateEditDateTriggerState);

// Functions

async function addTodo() {
    const text = todoInput.value.trim();
    const date = todoDate.value;
    const priority = todoPriorityBtn.dataset.priority;
    if (text === '') return;

    const newId = Date.now(); // Use timestamp as ID
    const newTodo = {
        id: newId,
        text: text,
        dueDate: date,
        priority: priority,
        completed: false,
        subtasks: [],
        recurring: isRecurring,
        pinned: false
    };

    todos.push(newTodo);
    saveTodos();
    applyCurrentSort();

    todoInput.value = '';
    todoDate.value = '';
    updateDateTriggerState();
    updatePriorityIcon('medium');

    isRecurring = false;
    todoRepeatBtn.classList.remove('active');
    todoInput.focus();
}

// Date Trigger Logic
const dateTrigger = document.getElementById('date-trigger');
const addBtn = document.getElementById('add-btn');

todoDate.addEventListener('change', updateDateTriggerState);
addBtn.addEventListener('click', addTodo);

dateTrigger.addEventListener('click', () => {
    try {
        todoDate.showPicker();
    } catch (error) {
        todoDate.focus();
        todoDate.click();
    }
});

function updateDateTriggerState() {
    if (todoDate.value) {
        dateTrigger.classList.add('has-date');
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
        // Recurring: Reschedule
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const yyyy = tomorrow.getFullYear();
        const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const dd = String(tomorrow.getDate()).padStart(2, '0');

        todo.dueDate = `${yyyy}-${mm}-${dd}`;
    } else {
        todo.completed = !todo.completed;
    }
    saveTodos();
    applyCurrentSort();
}

function deleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
}

function clearCompleted() {
    if (!confirm('Are you sure you want to delete ALL completed tasks?')) return;
    todos = todos.filter(t => !t.completed);
    saveTodos();
    renderTodos();
}

function openEditModal(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    editingId = id;
    editText.value = todo.text;
    editText.value = todo.text;
    editDate.value = todo.dueDate || '';
    updateEditDateTriggerState(); // New helper
    updateEditPriorityIcon(todo.priority || 'medium'); // New helper

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

    const todo = todos.find(t => t.id === editingId);
    if (todo) {
        todo.text = newText;
        todo.dueDate = editDate.value;
        todo.priority = editPriorityBtn.dataset.priority;
        todo.subtasks = editingSubtasks;
        saveTodos();
        applyCurrentSort();
    }

    closeEditModal();
}

function renderTodos() {
    todoList.innerHTML = '';

    // Filter logic
    const filteredTodos = todos.filter(todo => {
        let matchesStatus = true;

        if (currentFilter === 'today') {
            if (!todo.dueDate) {
                matchesStatus = false;
            } else {
                const date = new Date(todo.dueDate);
                const today = new Date();
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

        const matchesSearch = todo.text.toLowerCase().includes(searchQuery);

        return matchesStatus && matchesSearch;
    });

    logToScreen(`Rendering: Total=${todos.length}, Filtered=${filteredTodos.length}, Filter=${currentFilter}`);

    const activeCount = todos.filter(t => !t.completed).length;
    itemsLeft.innerText = `${activeCount} item${activeCount !== 1 ? 's' : ''} left`;

    filteredTodos.forEach((todo, index) => {
        const li = document.createElement('li');
        li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
        li.dataset.id = todo.id;
        li.draggable = true;
        li.style.animationDelay = `${index * 0.05}s`;

        let priorityHtml = '';
        if (todo.priority === 'high') priorityHtml = '<i class="ph ph-flag ph-fill list-priority-icon priority-high" title="High Priority"></i>';
        else if (todo.priority === 'medium') priorityHtml = '<i class="ph ph-flag list-priority-icon priority-medium" title="Medium Priority"></i>';
        else if (todo.priority === 'low') priorityHtml = '<i class="ph ph-flag list-priority-icon priority-low" title="Low Priority"></i>';

        const recurringHtml = todo.recurring
            ? '<i class="ph ph-arrows-clockwise recurring-icon" title="Daily Habit"></i>'
            : '';

        const pinClass = todo.pinned ? 'active' : '';
        const pinHtml = `
            <button class="pin-btn ${pinClass}" aria-label="Toggle Pin" title="${todo.pinned ? 'Unpin' : 'Pin to top'}">
                <i class="ph ph-push-pin ${todo.pinned ? 'ph-fill' : ''}"></i>
            </button>
        `;

        const dateInfo = formatDueDate(todo.dueDate, todo.completed);
        const dateHtml = todo.dueDate
            ? `<span class="todo-date"><i class="ph ph-calendar-blank"></i> ${dateInfo.text}</span>`
            : '';

        if (dateInfo.class) {
            li.classList.add(dateInfo.class);
        }

        if (todo.pinned) {
            li.classList.add('pinned');
        }

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
                    ${pinHtml}
                </div>
                ${dateHtml}
                ${subtasksHtml}
            </div>
            <button class="delete-btn" aria-label="Delete Task">
                <i class="ph ph-trash"></i>
            </button>
        `;

        const pinBtn = li.querySelector('.pin-btn');
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            togglePin(todo.id);
        });

        const checkCircle = li.querySelector('.check-circle');
        checkCircle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTodo(todo.id);
        });

        const contentDiv = li.querySelector('.todo-content');
        contentDiv.addEventListener('click', (e) => {
            openEditModal(todo.id);
        });

        const deleteBtn = li.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteTodo(todo.id);
        });

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

    enableDragAndDrop();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDueDate(dateString, isCompleted) {
    if (!dateString) return { text: '', class: '' };

    // Explicitly parse YYYY-MM-DD to create a local Date object at 00:00:00
    // This avoids UTC offset issues with new Date("YYYY-MM-DD")
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Normalize comparison dates to 00:00:00 local time
    // date is already 00:00:00 local because of the constructor above
    today.setHours(0, 0, 0, 0);
    tomorrow.setHours(0, 0, 0, 0);

    if (date.getTime() < today.getTime() && !isCompleted) {
        return { text: `${dateString} 期限切れ❕`, class: 'overdue' };
    } else if (date.getTime() === today.getTime()) {
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
        // We must update the entire subtasks array for that doc
        // We must update the entire subtasks array for that doc
        todo.subtasks = todo.subtasks.map(sub =>
            sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
        );
        saveTodos();
        renderTodos();
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

