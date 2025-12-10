// ==================== CONFIGURATION ====================
const SECURITY = {
    APP_ID: 'kachin_visions_empire_v1.0',
    ENCRYPTION_KEY: 'KVESecure2024@VideoPlatform!EncryptionKey',
    DEVICE_ID_KEY: 'kve_device_id',
    STORAGE_PREFIX: 'kve_secure_',
    CUSTOM_IMAGE_URL: 'https://res.cloudinary.com/zaumaran/image/upload/v1764932924/Kachin_Vision_Empire_For_Logo_zpkdbg.png'
};

// ==================== APP STATE ====================
let videos = [];
let stories = [];
let contactLinks = [];
let passwords = [];
let unlockedVideos = new Set();
let currentStory = null;
let isOnline = true;
let currentVideoToUnlock = null;
let deviceId = null;
let downloadedVideos = {};
let passwordExpandTimer = null;
let isPasswordExpanded = false;
let videoPreloadCache = new Map();
let preloadedVideos = new Set();
let videoPreloadQueue = [];
let isPreloading = false;

// ==================== DOM ELEMENTS ====================
const screens = document.querySelectorAll('.screen');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const connectionStatus = document.getElementById('connectionStatus');
const toast = document.getElementById('toast');
const downloadProgress = document.getElementById('downloadProgress');
const progressText = document.getElementById('progressText');
const progressFill = document.getElementById('progressFill');
const preloadStatus = document.getElementById('preloadStatus');
const preloadText = document.getElementById('preloadText');
const passwordIndicator = document.getElementById('passwordIndicator');

// Stories menu
const storiesToggle = document.getElementById('storiesToggle');
const storiesMenu = document.getElementById('storiesMenu');
const storyList = document.getElementById('storyList');

// Password section
const passwordSection = document.getElementById('passwordSection');
const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const passwordStatus = document.getElementById('passwordStatus');

// Video elements
const videoPlayer = document.getElementById('videoPlayer');
const defaultImage = document.getElementById('defaultImage');
const appImage = document.getElementById('appImage');
const videoList = document.getElementById('videoList');
const fullscreenBtn = document.getElementById('fullscreenBtn');

// Navigation
const contactBtn = document.getElementById('contactBtn');
const downloadedBtn = document.getElementById('downloadedBtn');
const installAppBtn = document.getElementById('installAppBtn');
const backButton = document.getElementById('backButton');
const backToMain = document.getElementById('backToMain');
const backToMainFromDownloaded = document.getElementById('backToMainFromDownloaded');

// Modals
const videoPasswordModal = document.getElementById('videoPasswordModal');
const videoPassword = document.getElementById('videoPassword');
const submitVideoPassword = document.getElementById('submitVideoPassword');
const cancelVideoPassword = document.getElementById('cancelVideoPassword');
const videoPasswordStatus = document.getElementById('videoPasswordStatus');
const noInternetModal = document.getElementById('noInternetModal');
const continueOfflineBtn = document.getElementById('continueOfflineBtn');

// Lists
const contactList = document.getElementById('contactList');
const downloadedList = document.getElementById('downloadedList');

// ==================== INITIALIZATION ====================
async function initApp() {
    showLoading('Initializing platform...');
    
    try {
        // Generate device ID
        deviceId = generateDeviceId();
        
        // Load custom image
        loadCustomImage();
        
        // Setup event listeners
        setupEventListeners();
        
        // Check connection
        updateConnectionStatus();
        
        // Initialize Firebase if available
        initFirebase();
        
        // Load all data
        await loadAllData();
        
        // Load downloaded videos
        loadDownloadedVideos();
        
        // Render UI
        renderStoryList();
        renderVideoList();
        renderContactList();
        renderDownloadedList();
        
        // Check remembered password
        checkRememberedPassword();
        
        // Start preloading
        startVideoPreloading();
        
        // Hide loading
        setTimeout(() => {
            hideLoading();
            showToast('Platform ready', 'success');
        }, 1000);
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Initialization failed', 'error');
        hideLoading();
    }
}

function initFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebaseConfig) {
            firebase.initializeApp(firebaseConfig);
            console.log('Firebase initialized successfully');
        } else {
            console.log('Firebase not available, using offline mode');
        }
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

// ==================== UTILITY FUNCTIONS ====================
function generateDeviceId() {
    let storedId = localStorage.getItem(SECURITY.DEVICE_ID_KEY);
    if (!storedId) {
        storedId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(SECURITY.DEVICE_ID_KEY, storedId);
    }
    return storedId;
}

function loadCustomImage() {
    if (appImage) {
        appImage.onload = function() {
            appImage.style.display = 'block';
            const placeholder = defaultImage.querySelector('.placeholder-text');
            if (placeholder) {
                placeholder.style.display = 'none';
            }
        };
        appImage.onerror = function() {
            appImage.style.display = 'none';
            const placeholder = defaultImage.querySelector('.placeholder-text');
            if (placeholder) {
                placeholder.style.display = 'flex';
            }
        };
        appImage.src = SECURITY.CUSTOM_IMAGE_URL;
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    // Stories menu
    if (storiesToggle) {
        storiesToggle.addEventListener('click', toggleStoriesMenu);
    }
    document.addEventListener('click', closeStoriesMenuOnClickOutside);
    
    // Password section
    if (passwordSection) {
        passwordSection.addEventListener('mouseenter', expandPasswordSection);
        passwordSection.addEventListener('mouseleave', startPasswordShrinkTimer);
    }
    
    if (unlockBtn) {
        unlockBtn.addEventListener('click', unlockVideos);
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') unlockVideos();
        });
    }
    
    // Navigation
    if (contactBtn) contactBtn.addEventListener('click', () => showScreen(2));
    if (downloadedBtn) downloadedBtn.addEventListener('click', () => showScreen(3));
    if (installAppBtn) installAppBtn.addEventListener('click', showInstallPrompt);
    if (backButton) backButton.addEventListener('click', handleBackButton);
    if (backToMain) backToMain.addEventListener('click', () => showScreen(1));
    if (backToMainFromDownloaded) backToMainFromDownloaded.addEventListener('click', () => showScreen(1));
    
    // Video player
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullScreen);
    }
    
    // Video password modal
    if (submitVideoPassword) {
        submitVideoPassword.addEventListener('click', unlockCurrentVideo);
    }
    if (cancelVideoPassword) {
        cancelVideoPassword.addEventListener('click', closeVideoPasswordModal);
    }
    if (videoPassword) {
        videoPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') unlockCurrentVideo();
        });
    }
    
    // Close modal when clicking outside
    if (videoPasswordModal) {
        videoPasswordModal.addEventListener('click', (e) => {
            if (e.target === videoPasswordModal) {
                closeVideoPasswordModal();
            }
        });
    }
    
    // Offline modal
    if (continueOfflineBtn) {
        continueOfflineBtn.addEventListener('click', () => {
            noInternetModal.style.display = 'none';
        });
    }
    
    // Network events
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    
    // Video player security
    if (videoPlayer) {
        videoPlayer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
    }
    
    // Fullscreen change
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
    document.addEventListener('mozfullscreenchange', handleFullScreenChange);
    document.addEventListener('MSFullscreenChange', handleFullScreenChange);
}

function showInstallPrompt() {
    const installPrompt = document.getElementById('installPrompt');
    if (installPrompt) {
        installPrompt.style.display = 'block';
    }
}

// ==================== STORIES MENU ====================
function toggleStoriesMenu(e) {
    e.stopPropagation();
    if (storiesMenu) {
        storiesMenu.classList.toggle('active');
    }
}

function closeStoriesMenuOnClickOutside(e) {
    if (storiesToggle && storiesMenu && 
        !storiesToggle.contains(e.target) && !storiesMenu.contains(e.target)) {
        storiesMenu.classList.remove('active');
    }
}

// ==================== PASSWORD SECTION ====================
function expandPasswordSection() {
    clearTimeout(passwordExpandTimer);
    
    if (!isPasswordExpanded) {
        passwordSection.classList.add('expanded');
        isPasswordExpanded = true;
        
        setTimeout(() => {
            if (passwordInput) passwordInput.focus();
        }, 300);
    }
}

function startPasswordShrinkTimer() {
    if (isPasswordExpanded) {
        clearTimeout(passwordExpandTimer);
        passwordExpandTimer = setTimeout(shrinkPasswordSection, 6000);
    }
}

function shrinkPasswordSection() {
    passwordSection.classList.remove('expanded');
    isPasswordExpanded = false;
}

// ==================== DATA LOADING ====================
async function loadAllData() {
    try {
        // Load from cache first
        loadFromCache();
        
        // Try to load from Firebase if online
        if (navigator.onLine) {
            await Promise.all([
                loadVideosFromFirebase(),
                loadPasswordsFromFirebase(),
                loadContactLinksFromFirebase()
            ]);
        }
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

function loadFromCache() {
    // Load videos from cache
    const cachedVideos = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'videos');
    const cachedStories = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'stories');
    
    if (cachedVideos) {
        try {
            videos = JSON.parse(cachedVideos);
        } catch (e) {
            videos = [];
        }
    }
    
    if (cachedStories) {
        try {
            stories = JSON.parse(cachedStories);
        } catch (e) {
            stories = [];
        }
    }
    
    // Load passwords from cache
    const cachedPasswords = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'passwords');
    if (cachedPasswords) {
        try {
            passwords = JSON.parse(cachedPasswords);
        } catch (e) {
            passwords = [];
        }
    }
    
    // Load contacts from cache
    const cachedContacts = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'contacts');
    if (cachedContacts) {
        try {
            contactLinks = JSON.parse(cachedContacts);
        } catch (e) {
            contactLinks = [];
        }
    }
}

async function loadVideosFromFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const snapshot = await db.collection('videos').get();
            videos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Extract stories
            const storySet = new Set();
            videos.forEach(video => {
                if (video.storyName) {
                    storySet.add(video.storyName);
                }
            });
            stories = Array.from(storySet).sort();
            
            // Cache for offline
            localStorage.setItem(SECURITY.STORAGE_PREFIX + 'videos', JSON.stringify(videos));
            localStorage.setItem(SECURITY.STORAGE_PREFIX + 'stories', JSON.stringify(stories));
            
            console.log(`${videos.length} videos loaded from Firebase`);
        }
    } catch (error) {
        console.error('Error loading videos from Firebase:', error);
    }
}

async function loadPasswordsFromFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const snapshot = await db.collection('passwords').get();
            passwords = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            localStorage.setItem(SECURITY.STORAGE_PREFIX + 'passwords', JSON.stringify(passwords));
            console.log(`${passwords.length} passwords loaded from Firebase`);
        }
    } catch (error) {
        console.error('Error loading passwords from Firebase:', error);
    }
}

async function loadContactLinksFromFirebase() {
    try {
        if (typeof firebase !== 'undefined' && firebase.firestore) {
            const db = firebase.firestore();
            const snapshot = await db.collection('contactLinks').get();
            contactLinks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            localStorage.setItem(SECURITY.STORAGE_PREFIX + 'contacts', JSON.stringify(contactLinks));
            console.log(`${contactLinks.length} contact links loaded from Firebase`);
        }
    } catch (error) {
        console.error('Error loading contact links from Firebase:', error);
    }
}

function loadDownloadedVideos() {
    const saved = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'downloaded');
    if (saved) {
        try {
            downloadedVideos = JSON.parse(saved);
        } catch (e) {
            downloadedVideos = {};
        }
    }
}

function saveDownloadedVideos() {
    localStorage.setItem(SECURITY.STORAGE_PREFIX + 'downloaded', JSON.stringify(downloadedVideos));
}

// ==================== ENCRYPTION FUNCTIONS ====================
function encryptVideoData(videoData) {
    try {
        const dataToEncrypt = {
            ...videoData,
            _deviceId: deviceId,
            _appId: SECURITY.APP_ID,
            _timestamp: Date.now(),
            _expires: Date.now() + (30 * 24 * 60 * 60 * 1000)
        };
        
        const key = CryptoJS.SHA256(SECURITY.ENCRYPTION_KEY + deviceId).toString();
        const encrypted = CryptoJS.AES.encrypt(JSON.stringify(dataToEncrypt), key).toString();
        return encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        return null;
    }
}

function decryptVideoData(encryptedData) {
    try {
        const key = CryptoJS.SHA256(SECURITY.ENCRYPTION_KEY + deviceId).toString();
        const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
        const jsonData = decrypted.toString(CryptoJS.enc.Utf8);
        
        if (!jsonData) {
            throw new Error('Decryption failed');
        }
        
        const data = JSON.parse(jsonData);
        
        // Verify device and app
        if (data._deviceId !== deviceId || data._appId !== SECURITY.APP_ID) {
            throw new Error('Invalid video file');
        }
        
        // Check expiration
        if (data._expires && Date.now() > data._expires) {
            throw new Error('Video has expired');
        }
        
        // Remove security metadata
        delete data._deviceId;
        delete data._appId;
        delete data._timestamp;
        delete data._expires;
        
        return data;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// ==================== RENDER FUNCTIONS ====================
function renderStoryList() {
    if (!storyList) return;
    
    storyList.innerHTML = '';
    
    // Add "All Stories" option
    const allItem = document.createElement('div');
    allItem.className = `story-item ${!currentStory ? 'active' : ''}`;
    allItem.textContent = 'All Stories';
    allItem.addEventListener('click', () => {
        currentStory = null;
        renderVideoList();
        if (storiesMenu) storiesMenu.classList.remove('active');
    });
    storyList.appendChild(allItem);
    
    // Add each story
    stories.forEach(story => {
        const storyItem = document.createElement('div');
        storyItem.className = `story-item ${currentStory === story ? 'active' : ''}`;
        storyItem.textContent = story;
        storyItem.addEventListener('click', () => {
            currentStory = story;
            renderVideoList();
            if (storiesMenu) storiesMenu.classList.remove('active');
        });
        storyList.appendChild(storyItem);
    });
}

function renderVideoList() {
    if (!videoList) return;
    
    if (videos.length === 0) {
        videoList.innerHTML = `
            <div class="loading-videos">
                <i class="fas fa-film"></i>
                <div>No videos available</div>
            </div>
        `;
        return;
    }
    
    let videosToShow = videos;
    
    // Filter by selected story
    if (currentStory) {
        videosToShow = videos.filter(v => v.storyName === currentStory);
        if (backButton) backButton.style.display = 'flex';
    } else {
        if (backButton) backButton.style.display = 'none';
    }
    
    // Sort videos
    videosToShow.sort((a, b) => {
        if (a.storyName && b.storyName) {
            return a.storyName.localeCompare(b.storyName);
        }
        return a.name.localeCompare(b.name);
    });
    
    videoList.innerHTML = '';
    
    videosToShow.forEach(video => {
        const isFree = video.passwordType === 'free';
        const isUnlocked = isFree || unlockedVideos.has(video.id) || 
                         (video.storyName && unlockedVideos.has(video.storyName));
        const isDownloaded = downloadedVideos[video.id];
        const canDownload = video.downloadable === true;
        const isPreloaded = preloadedVideos.has(video.id);
        
        const videoItem = document.createElement('div');
        videoItem.className = `video-item ${!isUnlocked ? 'locked' : 'unlocked'} ${isFree ? 'free' : ''} ${isDownloaded ? 'downloaded' : ''}`;
        
        videoItem.innerHTML = `
            <div class="video-info">
                <div class="video-name">${escapeHtml(video.name)} ${isPreloaded ? '<i class="fas fa-bolt" style="color: #00ff00; margin-left: 5px; font-size: 10px;"></i>' : ''}</div>
                <div class="video-meta">
                    ${video.type || 'Video'} ${video.storyName ? `• ${escapeHtml(video.storyName)}` : ''}
                    ${isDownloaded ? '<span style="color: #ff9900; margin-left: 5px;"><i class="fas fa-check"></i> Downloaded</span>' : ''}
                    ${canDownload && isUnlocked ? '<span style="color: #00cc88; margin-left: 5px;"><i class="fas fa-download"></i> Downloadable</span>' : ''}
                </div>
            </div>
            <div class="video-actions">
                ${isFree ? '<span class="free-badge">FREE</span>' : ''}
                ${isDownloaded ? `
                    <button class="action-btn play" data-action="play-downloaded" data-id="${video.id}">
                        <i class="fas fa-play"></i>
                    </button>
                ` : ''}
                ${canDownload && isUnlocked && !isDownloaded ? `
                    <button class="action-btn download" data-action="download" data-id="${video.id}">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
                ${isDownloaded ? `
                    <button class="action-btn delete" data-action="delete" data-id="${video.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                ` : ''}
            </div>
        `;
        
        // Add event listeners for action buttons
        const actionButtons = videoItem.querySelectorAll('[data-action]');
        actionButtons.forEach(btn => {
            const action = btn.dataset.action;
            const videoId = btn.dataset.id;
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                switch(action) {
                    case 'play-downloaded':
                        playDownloadedVideo(videoId);
                        break;
                    case 'download':
                        downloadVideo(videoId);
                        break;
                    case 'delete':
                        if (confirm('Delete this downloaded video?')) {
                            deleteDownloadedVideo(videoId);
                            renderVideoList();
                            renderDownloadedList();
                            showToast('Video deleted', 'success');
                        }
                        break;
                }
            });
        });
        
        // Click on video item to play
        videoItem.addEventListener('click', () => {
            if (!isUnlocked) {
                if (video.passwordType === 'password') {
                    currentVideoToUnlock = video;
                    showVideoPasswordModal();
                } else {
                    showToast('Password required', 'error');
                }
            } else if (!isDownloaded) {
                playVideo(video);
            } else {
                playDownloadedVideo(video.id);
            }
        });
        
        videoList.appendChild(videoItem);
    });
}

function renderContactList() {
    if (!contactList) return;
    
    if (contactLinks.length === 0) {
        contactList.innerHTML = `
            <div class="loading-videos">
                <i class="fas fa-link"></i>
                <div>No contact links available</div>
            </div>
        `;
        return;
    }
    
    contactList.innerHTML = '';
    
    contactLinks.forEach(link => {
        const linkItem = document.createElement('div');
        linkItem.className = 'video-item';
        
        let icon = 'fa-link';
        let color = '#ff9900';
        
        switch(link.type) {
            case 'facebook': icon = 'fa-facebook'; color = '#1877F2'; break;
            case 'telegram': icon = 'fa-telegram'; color = '#0088cc'; break;
            case 'viber': icon = 'fa-viber'; color = '#7360F2'; break;
            case 'whatsapp': icon = 'fa-whatsapp'; color = '#25D366'; break;
            default: icon = 'fa-link'; color = '#ff9900';
        }
        
        linkItem.innerHTML = `
            <div class="video-info">
                <div class="video-name">${escapeHtml(link.name)}</div>
                <div class="video-meta">${escapeHtml(link.type.charAt(0).toUpperCase() + link.type.slice(1))}</div>
            </div>
            <a href="${escapeHtml(link.url)}" target="_blank" class="action-btn play" 
               style="text-decoration: none; background: ${color};">
                <i class="fab ${icon}"></i>
            </a>
        `;
        
        contactList.appendChild(linkItem);
    });
}

function renderDownloadedList() {
    if (!downloadedList) return;
    
    const videoIds = Object.keys(downloadedVideos);
    
    if (videoIds.length === 0) {
        downloadedList.innerHTML = `
            <div class="no-downloads">
                <i class="fas fa-download"></i>
                <div>No downloaded videos</div>
                <div class="hint">Download videos when online to watch offline</div>
            </div>
        `;
        return;
    }
    
    downloadedList.innerHTML = '';
    
    videoIds.forEach(videoId => {
        const videoInfo = downloadedVideos[videoId];
        
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item downloaded';
        
        videoItem.innerHTML = `
            <div class="video-info">
                <div class="video-name">${escapeHtml(videoInfo.name)}</div>
                <div class="video-meta">
                    ${videoInfo.type || 'Video'} ${videoInfo.story ? `• ${escapeHtml(videoInfo.story)}` : ''}
                    <div style="font-size: 9px; color: #8a93a7; margin-top: 2px;">
                        <i class="fas fa-calendar"></i> Downloaded: ${new Date(videoInfo.downloadDate).toLocaleDateString()}
                    </div>
                </div>
            </div>
            <div class="video-actions">
                <button class="action-btn play" data-action="play" data-id="${videoId}">
                    <i class="fas fa-play"></i>
                </button>
                <button class="action-btn delete" data-action="delete" data-id="${videoId}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners
        const playBtn = videoItem.querySelector('[data-action="play"]');
        const deleteBtn = videoItem.querySelector('[data-action="delete"]');
        
        if (playBtn) {
            playBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                playDownloadedVideo(videoId);
            });
        }
        
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this downloaded video?')) {
                    deleteDownloadedVideo(videoId);
                    renderDownloadedList();
                    renderVideoList();
                    showToast('Video deleted', 'success');
                }
            });
        }
        
        // Click on item to play
        videoItem.addEventListener('click', (e) => {
            if (!e.target.closest('.video-actions')) {
                playDownloadedVideo(videoId);
            }
        });
        
        downloadedList.appendChild(videoItem);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== VIDEO FUNCTIONS ====================
function playVideo(video) {
    try {
        showLoading('Loading video...');
        
        if (defaultImage) defaultImage.style.display = 'none';
        if (videoPlayer) videoPlayer.style.display = 'block';
        if (fullscreenBtn) fullscreenBtn.style.display = 'block';
        
        if (videoPlayer) {
            videoPlayer.src = video.url;
            
            // Add security attributes
            videoPlayer.setAttribute('controlsList', 'nodownload noremoteplayback');
            videoPlayer.setAttribute('disablepictureinpicture', 'true');
            
            videoPlayer.oncanplay = () => {
                hideLoading();
                videoPlayer.play().catch(e => {
                    console.log('Auto-play prevented:', e);
                });
                
                // Highlight playing video
                document.querySelectorAll('.video-item').forEach(item => {
                    item.classList.remove('playing');
                });
                
                const currentItem = Array.from(document.querySelectorAll('.video-item')).find(item => {
                    const nameDiv = item.querySelector('.video-name');
                    return nameDiv && nameDiv.textContent.includes(video.name);
                });
                
                if (currentItem) {
                    currentItem.classList.add('playing');
                }
            };
            
            videoPlayer.onerror = () => {
                hideLoading();
                showToast('Error loading video', 'error');
                if (defaultImage) defaultImage.style.display = 'flex';
                if (videoPlayer) videoPlayer.style.display = 'none';
                if (fullscreenBtn) fullscreenBtn.style.display = 'none';
            };
            
            // Cache this video for future
            if (!preloadedVideos.has(video.id)) {
                preloadVideo(video.url);
                preloadedVideos.add(video.id);
            }
        }
        
    } catch (error) {
        hideLoading();
        showToast('Error playing video', 'error');
        console.error('Play video error:', error);
    }
}

async function playDownloadedVideo(videoId) {
    try {
        showLoading('Loading downloaded video...');
        
        const videoData = downloadedVideos[videoId];
        if (!videoData) {
            throw new Error('Video not found');
        }
        
        // Decrypt video data
        const decryptedData = decryptVideoData(videoData.encryptedData);
        if (!decryptedData) {
            throw new Error('Failed to decrypt video');
        }
        
        if (defaultImage) defaultImage.style.display = 'none';
        if (videoPlayer) videoPlayer.style.display = 'block';
        if (fullscreenBtn) fullscreenBtn.style.display = 'block';
        
        if (videoPlayer) {
            videoPlayer.src = decryptedData.url;
            
            // Add security attributes
            videoPlayer.setAttribute('controlsList', 'nodownload noremoteplayback');
            videoPlayer.setAttribute('disablepictureinpicture', 'true');
            
            videoPlayer.oncanplay = () => {
                hideLoading();
                videoPlayer.play().catch(e => {
                    console.log('Auto-play prevented:', e);
                });
            };
            
            videoPlayer.onerror = () => {
                hideLoading();
                showToast('Error playing downloaded video', 'error');
                if (defaultImage) defaultImage.style.display = 'flex';
                if (videoPlayer) videoPlayer.style.display = 'none';
                if (fullscreenBtn) fullscreenBtn.style.display = 'none';
            };
        }
        
    } catch (error) {
        hideLoading();
        showToast('Cannot play downloaded video', 'error');
        console.error('Play downloaded error:', error);
    }
}

// ==================== VIDEO PRELOADING ====================
function preloadVideo(url) {
    if (!videoPreloadCache.has(url)) {
        const video = document.createElement('video');
        video.preload = 'auto';
        video.style.display = 'none';
        video.src = url;
        video.load();
        videoPreloadCache.set(url, video);
        return video;
    }
    return videoPreloadCache.get(url);
}

function startVideoPreloading() {
    if (!videos.length) return;
    
    // Filter Cloudinary videos
    const cloudinaryVideos = videos.filter(video => 
        video.url && video.url.includes('cloudinary.com') && 
        (video.passwordType === 'free' || unlockedVideos.has(video.id))
    );
    
    if (cloudinaryVideos.length === 0) {
        if (preloadText) preloadText.textContent = 'No videos to preload';
        setTimeout(() => {
            if (preloadStatus) preloadStatus.style.display = 'none';
        }, 2000);
        return;
    }
    
    if (preloadStatus) {
        preloadStatus.style.display = 'flex';
        if (preloadText) preloadText.textContent = `Preloading ${cloudinaryVideos.length} videos...`;
    }
    
    // Create preload queue
    videoPreloadQueue = [...cloudinaryVideos];
    
    // Start preloading
    preloadNextVideo();
}

function preloadNextVideo() {
    if (videoPreloadQueue.length === 0) {
        if (preloadText) preloadText.textContent = 'All videos preloaded';
        if (preloadStatus) {
            preloadStatus.style.background = 'rgba(0, 255, 0, 0.2)';
            preloadStatus.style.borderColor = 'rgba(0, 255, 0, 0.3)';
            preloadStatus.style.color = '#00ff00';
            
            setTimeout(() => {
                preloadStatus.style.display = 'none';
            }, 3000);
        }
        return;
    }
    
    const video = videoPreloadQueue.shift();
    
    if (!preloadedVideos.has(video.id)) {
        preloadVideo(video.url);
        preloadedVideos.add(video.id);
        
        // Update preload status
        const remaining = videoPreloadQueue.length;
        const total = remaining + preloadedVideos.size;
        const percent = Math.round((preloadedVideos.size / total) * 100);
        if (preloadText) preloadText.textContent = `Preloaded ${percent}%`;
        
        // Continue preloading
        setTimeout(preloadNextVideo, 300);
    } else {
        preloadNextVideo();
    }
}

// ==================== DOWNLOAD FUNCTIONS ====================
async function downloadVideo(videoId) {
    try {
        const video = videos.find(v => v.id === videoId);
        if (!video) {
            throw new Error('Video not found');
        }
        
        if (video.downloadable !== true) {
            showToast('This video cannot be downloaded', 'error');
            return;
        }
        
        if (!navigator.onLine) {
            showToast('Need internet connection to download', 'error');
            return;
        }
        
        showDownloadProgress(`Downloading: ${video.name}`, 0);
        
        // Fetch video data
        const response = await fetch(video.url);
        if (!response.ok) {
            throw new Error('Failed to fetch video');
        }
        
        const contentLength = response.headers.get('content-length');
        const totalBytes = contentLength ? parseInt(contentLength) : 0;
        let loadedBytes = 0;
        
        // Read stream with progress
        const reader = response.body.getReader();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            chunks.push(value);
            loadedBytes += value.length;
            
            // Update progress
            if (totalBytes > 0) {
                const progress = Math.round((loadedBytes / totalBytes) * 100);
                updateDownloadProgress(progress);
            }
        }
        
        // Combine chunks
        const blob = new Blob(chunks);
        const blobUrl = URL.createObjectURL(blob);
        
        // Prepare video data for encryption
        const videoData = {
            ...video,
            url: blobUrl,
            blobSize: blob.size,
            downloadDate: Date.now()
        };
        
        // Encrypt and save
        const encryptedData = encryptVideoData(videoData);
        if (!encryptedData) {
            throw new Error('Encryption failed');
        }
        
        downloadedVideos[videoId] = {
            encryptedData,
            name: video.name,
            type: video.type,
            story: video.storyName,
            downloadDate: Date.now(),
            size: blob.size
        };
        
        saveDownloadedVideos();
        hideDownloadProgress();
        
        renderVideoList();
        renderDownloadedList();
        
        showToast('Video downloaded successfully', 'success');
        
        // Store blob URL for later use
        localStorage.setItem(SECURITY.STORAGE_PREFIX + 'blob_' + videoId, blobUrl);
        
    } catch (error) {
        hideDownloadProgress();
        showToast('Download failed', 'error');
        console.error('Download error:', error);
    }
}

function deleteDownloadedVideo(videoId) {
    if (downloadedVideos[videoId]) {
        // Revoke blob URL if exists
        const blobUrl = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'blob_' + videoId);
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl);
            localStorage.removeItem(SECURITY.STORAGE_PREFIX + 'blob_' + videoId);
        }
        
        delete downloadedVideos[videoId];
        saveDownloadedVideos();
    }
}

// ==================== PASSWORD FUNCTIONS ====================
function unlockVideos() {
    const password = passwordInput ? passwordInput.value.trim() : '';
    
    if (!password) {
        showToast('Enter password', 'error');
        return;
    }
    
    // Check for matching password
    const matchingPassword = passwords.find(p => p.password === password);
    
    if (matchingPassword) {
        if (matchingPassword.storyName) {
            unlockedVideos.add(matchingPassword.storyName);
            showToast(`Unlocked: ${matchingPassword.storyName}`, 'success');
        } else {
            videos.forEach(video => {
                if (video.passwordType === 'password') {
                    unlockedVideos.add(video.id);
                }
            });
            showToast('All videos unlocked', 'success');
        }
        
        // Remember password for 24 hours
        localStorage.setItem(SECURITY.STORAGE_PREFIX + 'remembered_password', JSON.stringify({
            password,
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000)
        }));
        
        // Update password indicator
        updatePasswordIndicator(true, matchingPassword.storyName || 'All Videos');
        
        renderVideoList();
        if (passwordInput) passwordInput.value = '';
        if (passwordStatus) {
            passwordStatus.textContent = '✓ Access granted';
            passwordStatus.style.color = '#00ff00';
        }
        
        // Auto-shrink after unlock
        startPasswordShrinkTimer();
        
        // Start preloading newly unlocked videos
        startVideoPreloading();
        
    } else {
        showToast('Invalid password', 'error');
        if (passwordStatus) {
            passwordStatus.textContent = '✗ Invalid password';
            passwordStatus.style.color = '#ff3e3e';
        }
    }
}

function unlockCurrentVideo() {
    const password = videoPassword ? videoPassword.value.trim() : '';
    
    if (!password) {
        if (videoPasswordStatus) {
            videoPasswordStatus.textContent = 'Enter password';
            videoPasswordStatus.style.color = '#ff3e3e';
        }
        return;
    }
    
    if (!currentVideoToUnlock) {
        closeVideoPasswordModal();
        return;
    }
    
    const matchingPassword = passwords.find(p => 
        p.password === password && 
        (p.storyName === currentVideoToUnlock.storyName || !p.storyName)
    );
    
    if (matchingPassword) {
        unlockedVideos.add(currentVideoToUnlock.id);
        closeVideoPasswordModal();
        playVideo(currentVideoToUnlock);
        renderVideoList();
        showToast('Video unlocked', 'success');
        
        // Update password indicator
        updatePasswordIndicator(true, currentVideoToUnlock.storyName || currentVideoToUnlock.name);
        
        // Preload this video
        if (!preloadedVideos.has(currentVideoToUnlock.id)) {
            preloadVideo(currentVideoToUnlock.url);
            preloadedVideos.add(currentVideoToUnlock.id);
        }
    } else {
        if (videoPasswordStatus) {
            videoPasswordStatus.textContent = 'Invalid password for this video';
            videoPasswordStatus.style.color = '#ff3e3e';
        }
        if (videoPassword) {
            videoPassword.value = '';
            videoPassword.focus();
        }
    }
}

function updatePasswordIndicator(isUnlocked, name = '') {
    if (!passwordIndicator) return;
    
    if (isUnlocked) {
        passwordIndicator.className = 'password-indicator';
        passwordIndicator.innerHTML = `<i class="fas fa-unlock"></i> <span>${escapeHtml(name) || 'Unlocked'}</span>`;
    } else {
        passwordIndicator.className = 'password-indicator locked';
        passwordIndicator.innerHTML = `<i class="fas fa-lock"></i> <span>Locked</span>`;
    }
}

function checkRememberedPassword() {
    const remembered = localStorage.getItem(SECURITY.STORAGE_PREFIX + 'remembered_password');
    if (remembered) {
        try {
            const data = JSON.parse(remembered);
            if (data.expires > Date.now()) {
                if (passwordInput) passwordInput.value = data.password;
                setTimeout(() => {
                    unlockVideos();
                }, 1000);
            } else {
                localStorage.removeItem(SECURITY.STORAGE_PREFIX + 'remembered_password');
            }
        } catch (e) {
            localStorage.removeItem(SECURITY.STORAGE_PREFIX + 'remembered_password');
        }
    }
}

// ==================== MODAL FUNCTIONS ====================
function showVideoPasswordModal() {
    if (videoPasswordModal) {
        videoPasswordModal.style.display = 'flex';
    }
    if (videoPassword) {
        videoPassword.value = '';
        videoPassword.focus();
    }
    if (videoPasswordStatus) {
        videoPasswordStatus.textContent = '';
    }
}

function closeVideoPasswordModal() {
    if (videoPasswordModal) {
        videoPasswordModal.style.display = 'none';
    }
    if (videoPassword) {
        videoPassword.value = '';
    }
    if (videoPasswordStatus) {
        videoPasswordStatus.textContent = '';
    }
    currentVideoToUnlock = null;
}

// ==================== SCREEN NAVIGATION ====================
function showScreen(screenNumber) {
    screens.forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(`screen${screenNumber}`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
    
    // Pause video when switching screens
    if (videoPlayer && !videoPlayer.paused) {
        videoPlayer.pause();
    }
    
    // Hide modals when switching screens
    if (videoPasswordModal) videoPasswordModal.style.display = 'none';
    if (noInternetModal) noInternetModal.style.display = 'none';
    
    // Hide fullscreen button
    if (fullscreenBtn) fullscreenBtn.style.display = 'none';
}

function handleBackButton() {
    if (currentStory) {
        currentStory = null;
        renderVideoList();
    }
}

// ==================== FULL SCREEN FUNCTIONS ====================
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        if (videoPlayer && videoPlayer.requestFullscreen) {
            videoPlayer.requestFullscreen();
        } else if (videoPlayer && videoPlayer.webkitRequestFullscreen) {
            videoPlayer.webkitRequestFullscreen();
        } else if (videoPlayer && videoPlayer.mozRequestFullScreen) {
            videoPlayer.mozRequestFullScreen();
        } else if (videoPlayer && videoPlayer.msRequestFullscreen) {
            videoPlayer.msRequestFullscreen();
        }
        if (fullscreenBtn) fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        if (fullscreenBtn) fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    }
}

function handleFullScreenChange() {
    if (!document.fullscreenElement && !document.webkitIsFullScreen && !document.mozFullScreen && !document.msFullscreenElement) {
        if (fullscreenBtn) fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    }
}

// ==================== NETWORK FUNCTIONS ====================
function updateConnectionStatus() {
    isOnline = navigator.onLine;
    
    if (isOnline) {
        if (connectionStatus) {
            connectionStatus.className = 'connection-status';
            connectionStatus.innerHTML = '<i class="fas fa-wifi"></i> <span>Online</span>';
        }
        
        // Start preloading when coming back online
        if (preloadedVideos.size === 0 && videos.length > 0) {
            startVideoPreloading();
        }
    } else {
        if (connectionStatus) {
            connectionStatus.className = 'connection-status offline';
            connectionStatus.innerHTML = '<i class="fas fa-wifi-slash"></i> <span>Offline</span>';
        }
        
        if (Object.keys(downloadedVideos).length === 0) {
            setTimeout(() => {
                if (noInternetModal) noInternetModal.style.display = 'flex';
            }, 1000);
        }
    }
}

// ==================== UI FEEDBACK FUNCTIONS ====================
function showToast(message, type = 'info') {
    if (!toast) return;
    
    const icon = type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                'fa-info-circle';
    
    const color = type === 'success' ? '#00ff00' :
                 type === 'error' ? '#ff3e3e' : '#ff9900';
    
    toast.innerHTML = `<i class="fas ${icon}" style="color: ${color};"></i> ${escapeHtml(message)}`;
    toast.style.display = 'flex';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function showLoading(text = 'Loading...') {
    if (loadingOverlay) loadingOverlay.style.display = 'flex';
    if (loadingText) loadingText.textContent = text;
}

function hideLoading() {
    if (loadingOverlay) loadingOverlay.style.display = 'none';
}

function showDownloadProgress(text, progress) {
    if (downloadProgress) {
        progressText.textContent = text;
        progressFill.style.width = `${progress}%`;
        downloadProgress.style.display = 'flex';
    }
}

function updateDownloadProgress(progress) {
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }
}

function hideDownloadProgress() {
    if (downloadProgress) {
        downloadProgress.style.display = 'none';
        progressFill.style.width = '0%';
    }
}

// ==================== INITIALIZE APP ====================
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the app
    initApp();
    
    // Prevent pull-to-refresh on mobile
    document.body.style.overscrollBehavior = 'none';
    
    // Prevent zoom on iOS
    document.addEventListener('touchmove', function(e) {
        if (e.scale !== 1) {
            e.preventDefault();
        }
    }, { passive: false });
});

// Handle app visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.hidden && videoPlayer && !videoPlayer.paused) {
        videoPlayer.pause();
    }
});