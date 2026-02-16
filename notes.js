(function() {
    const notesDrawer = document.getElementById('notes-drawer');
    const notesToggleBtn = document.getElementById('notes-toggle-btn');
    const closeNotesBtn = document.getElementById('close-notes-btn');
    const noteForm = document.getElementById('note-form');
    const notesList = document.getElementById('notes-list');
    const editNoteIdInput = document.getElementById('edit-note-id');
    const noteTitleInput = document.getElementById('note-title');
    const noteContentInput = document.getElementById('note-content');
    const saveBtn = document.getElementById('save-note-btn');

    const toggleDrawer = () => {
        notesDrawer.classList.toggle('hidden-drawer');
        if (!notesDrawer.classList.contains('hidden-drawer')) {
            loadNotes();
        }
    };

    const loadNotes = async () => {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const { data, error } = await supabaseClient
            .from('notes')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error(error);
            return;
        }
        renderNotes(data);
    };

    const renderNotes = (notes) => {
        notesList.innerHTML = '';
        notes.forEach(note => {
            const div = document.createElement('div');
            div.className = 'note-item';
            div.innerHTML = `
                <h4>${note.title}</h4>
                <p>${note.content}</p>
                <div class="note-actions">
                    <button class="note-btn edit-note-btn" data-id="${note.id}">Edit</button>
                    <button class="note-btn delete-note-btn" data-id="${note.id}">Delete</button>
                </div>
            `;
            notesList.appendChild(div);
        });
        
        document.querySelectorAll('.edit-note-btn').forEach(btn => {
            btn.onclick = () => {
                const id = btn.getAttribute('data-id');
                const note = notes.find(n => n.id === id);
                if (note) {
                    editNoteIdInput.value = note.id;
                    noteTitleInput.value = note.title;
                    noteContentInput.value = note.content;
                    saveBtn.innerText = 'Update Note';
                }
            };
        });

        document.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.onclick = async () => {
                const id = btn.getAttribute('data-id');
                if (confirm('Delete this note permanently?')) {
                    const { error } = await supabaseClient.from('notes').delete().eq('id', id);
                    if (!error) loadNotes();
                }
            };
        });
    };

    noteForm.onsubmit = async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const id = editNoteIdInput.value;
        const title = noteTitleInput.value;
        const content = noteContentInput.value;

        if (id) {
            await supabaseClient.from('notes').update({ title, content }).eq('id', id);
        } else {
            await supabaseClient.from('notes').insert([{ title, content, user_id: user.id }]);
        }

        noteForm.reset();
        editNoteIdInput.value = '';
        saveBtn.innerText = 'Save Note';
        loadNotes();
    };

    notesToggleBtn.onclick = toggleDrawer;
    closeNotesBtn.onclick = toggleDrawer;
})();