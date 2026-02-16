const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

const authModal = document.getElementById('auth-modal');
const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const modalTitle = document.getElementById('modal-title');
const submitBtn = document.getElementById('submit-btn');
const toggleAuth = document.getElementById('toggle-auth');
const userDisplay = document.getElementById('user-display');

const ideaModal = document.getElementById('idea-modal');
const ideaForm = document.getElementById('idea-form');
const createBtn = document.getElementById('create-btn');
const closeIdeaBtn = document.getElementById('close-idea-btn');
const workspaceGrid = document.getElementById('workspace-grid');
const ideaFile = document.getElementById('idea-file');
const uploadStatus = document.getElementById('upload-status');

const shareModal = document.getElementById('share-modal');
const shareForm = document.getElementById('share-form');
const closeShareBtn = document.getElementById('close-share-btn');
const searchBar = document.getElementById('search-bar');
const navButtons = document.querySelectorAll('.nav-btn');

const ideaModalTitle = document.getElementById('idea-modal-title');
const editIdeaIdInput = document.getElementById('edit-idea-id');

let isSignUp = false;
let currentView = 'all';
let allLoadedIdeas = [];

const collisionChannel = supabaseClient.channel('collision-room', {
    config: { broadcast: { self: false } }
});

collisionChannel
    .on('broadcast', { event: 'editing' }, (payload) => {
        const indicator = document.getElementById(`presence-${payload.payload.ideaId}`);
        if (indicator) {
            indicator.innerText = `● ${payload.payload.userEmail} is editing...`;
            indicator.classList.add('active');
            setTimeout(() => indicator.classList.remove('active'), 3000);
        }
    })
    .subscribe();

async function logActivity(ideaId, action) {
    const { data: { user } } = await supabaseClient.auth.getUser();
    await supabaseClient.from('logs').insert([{
        idea_id: ideaId,
        user_email: user.email,
        action: action
    }]);
}

async function uploadFile(file) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    let { error: uploadError } = await supabaseClient.storage
        .from('media')
        .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseClient.storage
        .from('media')
        .getPublicUrl(filePath);

    return { url: publicUrl, type: file.type };
}

async function fetchIdeas() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    let ideasData = [];

    if (currentView === 'all') {
        const { data, error } = await supabaseClient
            .from('ideas')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (!error) ideasData = data;
    } else if (currentView === 'shared') {
        const { data: sharedEntries, error: shareError } = await supabaseClient
            .from('shares')
            .select('idea_id')
            .eq('shared_with_email', user.email);

        if (!shareError && sharedEntries.length > 0) {
            const ideaIds = sharedEntries.map(entry => entry.idea_id);
            const { data, error } = await supabaseClient
                .from('ideas')
                .select('*')
                .in('id', ideaIds);
            if (!error) ideasData = data;
        }
    }

    allLoadedIdeas = ideasData;
    renderIdeas(allLoadedIdeas);
}

function renderIdeas(ideas) {
    workspaceGrid.innerHTML = '';
    ideas.forEach(idea => {
        const div = document.createElement('div');
        div.className = 'idea-card';
        
        let mediaHtml = '';
        if (idea.file_url) {
            if (idea.file_type.startsWith('image/')) {
                mediaHtml = `<div class="card-media"><img src="${idea.file_url}" loading="lazy"></div>`;
            } else if (idea.file_type.startsWith('video/')) {
                mediaHtml = `<div class="card-media"><video src="${idea.file_url}" controls></video></div>`;
            } else {
                mediaHtml = `<a href="${idea.file_url}" target="_blank" class="file-link">📄 View Document</a>`;
            }
        }

div.innerHTML = `
    <div class="presence-indicator" id="presence-${idea.id}">● Someone is viewing</div>
    ${mediaHtml}
    <p>${idea.content}</p>
    <div class="card-footer">
        <div class="tags">
            ${(idea.tags || []).map(tag => `<span class="tag-pill">${tag}</span>`).join('')}
            <button class="share-btn" data-id="${idea.id}">Share</button>
        </div>
        <div class="card-footer-actions">
            <button class="edit-idea" data-id="${idea.id}">Edit</button>
            <button class="delete-idea" data-id="${idea.id}">Delete</button>
        </div>
    </div>
`;
        workspaceGrid.appendChild(div);
    });

    attachCardListeners();
}

function attachCardListeners() {
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.getElementById('share-idea-id').value = e.target.getAttribute('data-id');
            shareModal.classList.remove('hidden');
        });
    });

    document.querySelectorAll('.delete-idea').forEach(btn => {
        btn.addEventListener('click', (e) => {
            deleteIdea(e.target.getAttribute('data-id'));
        });
    });

    document.querySelectorAll('.edit-idea').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        const idea = allLoadedIdeas.find(i => i.id == id);
        if (idea) {
            ideaModalTitle.innerText = 'Update Idea';
            editIdeaIdInput.value = idea.id;
            document.getElementById('idea-content').value = idea.content;
            document.getElementById('idea-tags').value = (idea.tags || []).join(', ');
            document.getElementById('idea-category').value = idea.category;
            ideaModal.classList.remove('hidden');
        }
    });
});

}

async function deleteIdea(id) {
    if (confirm('Delete this idea?')) {
        await logActivity(id, 'Deleted idea');
        const { error } = await supabaseClient.from('ideas').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchIdeas();
    }
}

async function shareIdea(ideaId, email, role) {
    const { error } = await supabaseClient
        .from('shares')
        .insert([{ idea_id: ideaId, shared_with_email: email, role: role }]);
    
    if (error) alert(error.message);
    else {
        await logActivity(ideaId, `Shared with ${email}`);
        alert('Shared successfully!');
        shareModal.classList.add('hidden');
    }
}

searchBar.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allLoadedIdeas.filter(idea => 
        idea.content.toLowerCase().includes(term) || 
        idea.category.toLowerCase().includes(term) ||
        idea.tags.some(tag => tag.toLowerCase().includes(term))
    );
    renderIdeas(filtered);
});

navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentView = btn.getAttribute('data-view');
        fetchIdeas();
    });
});

authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;

    if (isSignUp) {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) alert(error.message);
        else alert('Check your email!');
    } else {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else location.reload();
    }
});

toggleAuth.addEventListener('click', () => {
    isSignUp = !isSignUp;
    modalTitle.innerText = isSignUp ? 'Join START 2AM' : 'Welcome to 2AM';
    submitBtn.innerText = isSignUp ? 'Sign Up' : 'Sign In';
    toggleAuth.innerText = isSignUp ? 'Sign In' : 'Sign Up';
});

createBtn.addEventListener('click', () => {
    ideaForm.reset();
    editIdeaIdInput.value = '';
    ideaModalTitle.innerText = 'Capture Idea';
    ideaModal.classList.remove('hidden');
});

closeIdeaBtn.addEventListener('click', () => ideaModal.classList.add('hidden'));
closeShareBtn.addEventListener('click', () => shareModal.classList.add('hidden'));

ideaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = ideaForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    uploadStatus.innerText = 'Syncing to vault...';
    
    try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        const content = document.getElementById('idea-content').value;
        const tags = document.getElementById('idea-tags').value.split(',').map(t => t.trim());
        const category = document.getElementById('idea-category').value;
        const file = ideaFile.files[0];
        const editId = editIdeaIdInput.value;

        let fileUrl = null;
        let fileType = null;

        if (file) {
            const uploaded = await uploadFile(file);
            fileUrl = uploaded.url;
            fileType = uploaded.type;
        }

        if (editId) {
            const updateData = { content, tags, category };
            if (fileUrl) {
                updateData.file_url = fileUrl;
                updateData.file_type = fileType;
            }
            const { error } = await supabaseClient.from('ideas').update(updateData).eq('id', editId);
            if (error) throw error;
            await logActivity(editId, 'Updated idea');
        } else {
            const { data, error } = await supabaseClient.from('ideas').insert([
                { content, tags, category, user_id: user.id, file_url: fileUrl, file_type: fileType }
            ]).select();
            if (error) throw error;
            await logActivity(data[0].id, 'Created idea');
        }

        ideaForm.reset();
        ideaModal.classList.add('hidden');
        fetchIdeas();
    } catch (err) {
        alert(err.message);
    } finally {
        submitButton.disabled = false;
        uploadStatus.innerText = '';
    }
});

shareForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('share-idea-id').value;
    const email = document.getElementById('share-email').value;
    const role = document.getElementById('share-role').value;
    shareIdea(id, email, role);
});

async function checkUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        authModal.classList.add('hidden');
        userDisplay.innerHTML = `${session.user.email} <button id="logout-btn">Logout</button>`;
        document.getElementById('logout-btn').addEventListener('click', async () => {
            await supabaseClient.auth.signOut();
            location.reload();
        });
        fetchIdeas();
    } else {
        authModal.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', checkUser);