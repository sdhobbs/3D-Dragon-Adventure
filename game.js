import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// --- Core Setup ---
let scene, camera, renderer;
let playerObjectContainer;
const clock = new THREE.Clock();

// --- Player Movement State ---
const keyboardState = {};
const movementSpeed = 5.0;
const rotationSpeed = Math.PI / 2;
const flySpeed = 3.0;

// --- Game Objects ---
let shrineTarget;
let crystalObject; // Task 2 target
let villageMarker; // Task 3 location marker
let elderPlaceholder; // Task 3 target

// --- Game State & Task Management ---
let currentTask = 1; // Start at task 1
let hasCrystal = false; // Player state for Task 3
const completionRadius = 3.0; // How close the player needs to be for tasks

// --- Loader Manager ---
const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
    console.log("All assets loaded!");
    updateTaskUI(); // <<<--- Update UI based on current task state
};
loadingManager.onError = (url) => { /* ... (error handling) ... */ };
loadingManager.onProgress = (url, i, t) => { /* ... (progress handling) ... */ };


function init() {
    // 1. Scene, Camera, Renderer setup... (same as before)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB);
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // --- Lighting --- (same as before)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(5, 10, 7.5);
    scene.add(directionalLight);

    // --- Player Object Container & Model Loading --- (same as before)
    playerObjectContainer = new THREE.Object3D();
    playerObjectContainer.position.set(0, 1, 0);
    scene.add(playerObjectContainer);
    const loader = new GLTFLoader(loadingManager);
    loader.load('dragon.glb', (gltf) => { /* ... (model loading/scaling) ... */
        const loadedModel = gltf.scene;
        loadedModel.scale.set(0.5, 0.5, 0.5);
        playerObjectContainer.add(loadedModel);
     }, undefined, (error) => { /* ... (fallback cone) ... */
        console.error('Error loading dragon model:', error);
        const fallbackGeometry = new THREE.ConeGeometry(0.5, 1.5, 8);
        fallbackGeometry.rotateX(Math.PI / 2);
        const fallbackMaterial = new THREE.MeshStandardMaterial({ color: 0xff00ff });
        const fallbackMesh = new THREE.Mesh(fallbackGeometry, fallbackMaterial);
        playerObjectContainer.add(fallbackMesh);
     });


    // --- Create Task Objects ---

    // Task 1: Shrine Target (Yellow Wireframe Sphere)
    const shrineGeometry = new THREE.SphereGeometry(1, 16, 16);
    const shrineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00, wireframe: true });
    shrineTarget = new THREE.Mesh(shrineGeometry, shrineMaterial);
    shrineTarget.position.set(15, 5, 20); // Shrine position
    scene.add(shrineTarget); // Add immediately

    // Task 2: Crystal Object (Blue Octahedron - created but NOT added yet)
    const crystalGeometry = new THREE.OctahedronGeometry(0.7, 0); // Radius 0.7
    const crystalMaterial = new THREE.MeshStandardMaterial({
        color: 0x0088FF, // Blue
        emissive: 0x0044DD, // Slight blue glow
        roughness: 0.2,
        metalness: 0.5
    });
    crystalObject = new THREE.Mesh(crystalGeometry, crystalMaterial);
    // Position will be set near shrine when spawned

    // Task 3: Village & Elder Placeholders (Added immediately)
    const villageGeometry = new THREE.BoxGeometry(4, 1, 4); // Flat 'village' area marker
    const villageMaterial = new THREE.MeshStandardMaterial({ color: 0x00AA00 }); // Green
    villageMarker = new THREE.Mesh(villageGeometry, villageMaterial);
    villageMarker.position.set(-15, 0.5, -10); // Village position
    scene.add(villageMarker);

    const elderGeometry = new THREE.CapsuleGeometry(0.8, 2.5, 4, 10); // Taller capsule shape
    const elderMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 }); // Grey
    elderPlaceholder = new THREE.Mesh(elderGeometry, elderMaterial);
    // Position near the village marker
    elderPlaceholder.position.set(-15, 1.75, -12); // Above ground near village center
    scene.add(elderPlaceholder);

    // --- Ground Plane --- (same as before)
    const planeGeometry = new THREE.PlaneGeometry(100, 100); // Make larger for more travel
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    // --- Input & Resize Listeners --- (same as before)
    window.addEventListener('keydown', (event) => { keyboardState[event.code] = true; });
    window.addEventListener('keyup', (event) => { keyboardState[event.code] = false; });
    window.addEventListener('resize', onWindowResize, false);

    // Set initial loading message
    document.getElementById('game-info').querySelector('p').textContent = 'Loading assets...';

    animate(); // Start game loop
}


// --- Update Player Movement --- (same as before)
function updatePlayer(deltaTime) { /* ... WASDQE movement logic ... */
    if (!playerObjectContainer) return;
    const moveDistance = movementSpeed * deltaTime;
    const rotateAngle = rotationSpeed * deltaTime;
    const flyDistance = flySpeed * deltaTime;
    if (keyboardState['KeyW']) playerObjectContainer.translateZ(moveDistance);
    if (keyboardState['KeyS']) playerObjectContainer.translateZ(-moveDistance);
    if (keyboardState['KeyA']) playerObjectContainer.rotateY(rotateAngle);
    if (keyboardState['KeyD']) playerObjectContainer.rotateY(-rotateAngle);
    if (keyboardState['KeyE']) playerObjectContainer.position.y += flyDistance;
    if (keyboardState['KeyQ']) {
        const groundLevel = 0.1;
        playerObjectContainer.position.y = Math.max(groundLevel, playerObjectContainer.position.y - flyDistance);
    }
}


// --- Update Camera --- (same as before)
function updateCamera() { /* ... Follow camera logic ... */
    if (!playerObjectContainer) return;
    const offset = new THREE.Vector3(0, 3, -8);
    offset.applyQuaternion(playerObjectContainer.quaternion);
    const desiredCameraPosition = playerObjectContainer.position.clone().add(offset);
    const lerpFactor = 0.05;
    camera.position.lerp(desiredCameraPosition, lerpFactor);
    const lookAtPosition = playerObjectContainer.position.clone().add(new THREE.Vector3(0, 1, 0));
    camera.lookAt(lookAtPosition);
}


// --- Spawn Crystal Function --- <<<--- NEW
function spawnCrystal() {
    if (!crystalObject || crystalObject.parent === scene) return; // Don't spawn if null or already in scene

    // Position near the shrine
    crystalObject.position.copy(shrineTarget.position);
    crystalObject.position.y -= 1.0; // Place slightly below shrine center
    crystalObject.position.x += 1.5; // Offset slightly

    scene.add(crystalObject);
    console.log("Crystal spawned near shrine.");
}

// --- Update Task UI --- <<<--- NEW/REFACTORED
function updateTaskUI() {
    const taskInfoElement = document.getElementById('game-info').querySelector('p');
    switch (currentTask) {
        case 1:
            taskInfoElement.textContent = 'Task 1: Fly to the Ancient Shrine (Yellow Orb)';
            break;
        case 2:
            taskInfoElement.textContent = 'Task 2: Collect the Sacred Crystal (Blue Crystal)';
            break;
        case 3:
             if (hasCrystal) {
                taskInfoElement.textContent = 'Task 3: Deliver the Crystal to the Elder (Grey Capsule) at the Village (Green Platform)';
             } else {
                 // Should ideally not happen in task 3 state, but as fallback:
                 taskInfoElement.textContent = 'Task 3: Find the Elder... (Missing Crystal)';
             }
            break;
        case 4: // All tasks complete (for now)
             taskInfoElement.textContent = 'All Tasks Complete! The tribe is safe for now.';
             break;
        default:
             taskInfoElement.textContent = 'No current task.';
             break;
    }
}


// --- Check Task Completion --- <<<--- REFACTORED
function checkCurrentTaskCompletion() {
    if (!playerObjectContainer) return; // Need player

    const playerPos = playerObjectContainer.position;

    switch (currentTask) {
        case 1:
            if (shrineTarget && playerPos.distanceTo(shrineTarget.position) < completionRadius) {
                console.log("Task 1 Complete! Shrine Reached.");
                currentTask = 2; // Advance state
                // Change shrine appearance (make it solid green)
                if (shrineTarget.material) {
                    shrineTarget.material.color.set(0x00FF00);
                    shrineTarget.material.wireframe = false;
                }
                spawnCrystal(); // <<<--- Spawn the crystal for the next task
                updateTaskUI(); // Update objective display
            }
            break;

        case 2:
            // Check if crystal exists and is in the scene
            if (crystalObject && crystalObject.parent === scene && playerPos.distanceTo(crystalObject.position) < completionRadius) {
                console.log("Task 2 Complete! Crystal Collected.");
                currentTask = 3; // Advance state
                hasCrystal = true; // Player now has the crystal
                scene.remove(crystalObject); // Remove crystal from scene
                // No need to null crystalObject, we might reuse/respawn later
                updateTaskUI(); // Update objective display
            }
            break;

        case 3:
            // Check if player has crystal and is near the elder
            if (hasCrystal && elderPlaceholder && playerPos.distanceTo(elderPlaceholder.position) < completionRadius) {
                console.log("Task 3 Complete! Crystal Delivered.");
                currentTask = 4; // Advance state (or set to a 'finished' state)
                hasCrystal = false; // Crystal is delivered
                 // Optional: Change elder appearance (e.g., slightly lighter color)
                 if (elderPlaceholder.material) {
                     elderPlaceholder.material.color.set(0xA0A0A0);
                 }
                updateTaskUI(); // Update objective display
            }
            break;

        // case 4, 5, ... add more task checks here
    }

    // Optional: Add rotation to the crystal if it exists to make it more visible
    if (crystalObject && crystalObject.parent === scene) {
        crystalObject.rotation.y += 0.02; // Simple spin
    }
}


// --- Game Loop ---
function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    if (playerObjectContainer) {
        updatePlayer(deltaTime);
        updateCamera();
        checkCurrentTaskCompletion(); // <<<--- Check the CURRENT task
    }

    renderer.render(scene, camera);
}


// --- Handle Window Resizing --- (same as before)
function onWindowResize() { /* ... resize logic ... */
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Start the game ---
init();