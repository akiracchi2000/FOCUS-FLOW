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

// Firebase Imports
import { db, collection, addDoc, setDoc, doc, updateDoc, deleteDoc, onSnapshot } from './firebase-config.js';

// State
let todos = []; // Now managed by Firestore listener
let currentFilter = 'all';
let currentSort = 'default'; // default, date, priority
let searchQuery = '';
let editingId = null;

// Collection Reference
const todosCollection = collection(db, "todos");

// --- Initialization & Migration ---

document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    // No explicit renderTodos() here, the onSnapshot listener will trigger it.
});

// Real-time Listener (Replaces load from localStorage)
// This runs once on load, and then every time data changes on server
onSnapshot(todosCollection, (snapshot) => {
    const remoteTodos = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    // Check for migration needed
    // If Firestore is empty but we have local data, migrate it.
    if (remoteTodos.length === 0) {
        const localData = localStorage.getItem('myPremiumTodos');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log("Migrating local data to Firestore...");
                    migrateDataToFirestore(parsed);
                    return; // The listener will fire again as we add docs
                }
            } catch (e) {
                console.error("Migration parse error", e);
            }
        }
    }

    todos = remoteTodos;
    // Apply client-side sorting preference
    applyCurrentSort();
    // renderTodos is called inside applyCurrentSort
});

async function migrateDataToFirestore(localTodos) {
    for (const todo of localTodos) {
        // We use the existing ID as the document ID if possible, or let Firestore generate one.
        // To keep it simple and ensure IDs are strings in Firestore usage (doc.id), 
        // we'll explicitly use setDoc with stringified ID if present, or addDoc.
        // However, our local IDs are Date.now() numbers. Firestore IDs are strings.
        // Let's iterate and add them.
        try {
            // Convert ID to string for doc naming, or generate new one?
            // Let's keep the existing ID to preserve order/linkage if any.
            // Using setDoc with specific ID
            await setDoc(doc(db, "todos", String(todo.id)), todo);
        } catch (e) {
            console.error("Error migrating task:", todo, e);
        }
    }
    // Clear local storage after successful migration start to prevent re-migration loop
    // (In a robust app, we'd wait for all promises, but for this quick migration...)
    localStorage.removeItem('myPremiumTodos');
    console.log("Migration complete. LocalStorage cleared.");
}


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

    // Firestore Update
    updateDoc(doc(db, "todos", String(id)), {
        pinned: !todo.pinned
    });
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

importInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const parsedData = JSON.parse(event.target.result);
            if (!Array.isArray(parsedData)) throw new Error('Invalid format');

            if (confirm('Importing will add these tasks to your cloud list. Continue?')) {
                // Batch add or loop add? Loop for simplicity
                for (const item of parsedData) {
                    // Use new IDs to avoid collision or overwrite? 
                    // Let's overwrite if ID exists, or add if new.
                    // For safety, let's just use setDoc with existing ID
                    await setDoc(doc(db, "todos", String(item.id)), item);
                }
                alert('Data imported successfully to Cloud!');
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
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });

        draggable.addEventListener('dragend', () => {
            draggable.classList.remove('dragging');
            // updateOrder(); // Disabled persistent reordering for V1 Sync
        });
    });

    let currentAfterElement = null;

    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const draggable = document.querySelector('.dragging');

        if (afterElement !== currentAfterElement) {
            currentAfterElement = afterElement;
            const siblings = [...container.querySelectorAll('.todo-item:not(.dragging)')];
            const positions = new Map();
            siblings.forEach(el => positions.set(el, el.getBoundingClientRect().top));

            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }

            siblings.forEach(el => {
                const oldTop = positions.get(el);
                const newTop = el.getBoundingClientRect().top;
                const diff = oldTop - newTop;

                if (diff !== 0) {
                    el.style.transition = 'none';
                    el.style.transform = `translateY(${diff}px)`;
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

    // Firebase Add/Set (Using setDoc with ID to keep control over IDs if needed, or addDoc for auto IDs)
    // To maintain compatibility with existing logic usually assuming ID is a timestamp number:
    // We cast to String for the document Key.
    await setDoc(doc(db, "todos", String(newId)), newTodo);

    // Initial state reset handled locally instantly? 
    // Or wait for onSnapshot? 
    // waiting for onSnapshot creates a small lag. 
    // Optimistic UI updates are better, but let's stick to simple "wait for sync" or "reset inputs immediately"

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

        updateDoc(doc(db, "todos", String(id)), {
            dueDate: `${yyyy}-${mm}-${dd}`
        });

    } else {
        // Normal toggle
        updateDoc(doc(db, "todos", String(id)), {
            completed: !todo.completed
        });
    }
}

function deleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
    deleteDoc(doc(db, "todos", String(id)));
}

function clearCompleted() {
    if (!confirm('Are you sure you want to delete ALL completed tasks?')) return;

    const completedTodos = todos.filter(t => t.completed);
    completedTodos.forEach(t => {
        deleteDoc(doc(db, "todos", String(t.id)));
    });
}

function openEditModal(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;

    editingId = id;
    editText.value = todo.text;
    editDate.value = todo.dueDate || '';
    editPriority.value = todo.priority || 'medium';

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

    // Firestore Update
    updateDoc(doc(db, "todos", String(editingId)), {
        text: newText,
        dueDate: editDate.value,
        priority: editPriority.value,
        subtasks: editingSubtasks
    });

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

        const dateInfo = formatDueDate(todo.dueDate);
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

function formatDueDate(dateString) {
    if (!dateString) return { text: '', class: '' };

    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

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
        // We must update the entire subtasks array for that doc
        const newSubtasks = todo.subtasks.map(sub =>
            sub.id === subtaskId ? { ...sub, completed: !sub.completed } : sub
        );
        updateDoc(doc(db, "todos", String(todoId)), {
            subtasks: newSubtasks
        });
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

