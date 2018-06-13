$(document).ready(function () {
    if (!Detector.webgl) {

        Detector.addGetWebGLMessage();
        document.getElementById('container').innerHTML = "";

    }

    /*
     * global variables
     */
    var container;
    var camera, scene, renderer;

    // The material parameters for the floor, mirrors, beam splitter cubes and screen
    var screenMat, cubeMat, floorMat, planeMat, laserMat;

    // lighting variables
    var bulbLight, bulbMat, hemiLight;

    // Other variables (idk why)
    var object, loader, stats;

	// ref for solar irradiances: https://en.wikipedia.org/wiki/Lux
	var hemiLuminousIrradiances = {
        "0.0001 lx (Moonless Night)": 0.0001,
        "0.002 lx (Night Airglow)": 0.002,
        "0.5 lx (Full Moon)": 0.5,
        "3.4 lx (City Twilight)": 3.4,
        "50 lx (Living Room)": 50,
        "100 lx (Very Overcast)": 100
    };

    var bulbLuminousPowers = {
        "110000 lm (1000W)": 110000,
        "3500 lm (300W)": 3500,
        "1700 lm (100W)": 1700,
        "800 lm (60W)": 800,
        "400 lm (40W)": 400,
        "180 lm (25W)": 180,
        "20 lm (4W)": 20,
        "Off": 0
    };

    // parameters to vary in interactive simulation
    var params = {
        exposure: 0.68,
        hemiIrradiance: Object.keys( hemiLuminousIrradiances )[3],
        sampleAngle: 0,
        mirrorAngle: 0,
        shadows: true,
        bulbPower: Object.keys( bulbLuminousPowers )[ 4 ],
    }

    var clock = new THREE.Clock(); // keeps track of time

    // Start the simulation
    init();
    animate();

    /*
     * Creates the scene by assigning scene, camera and renderer
     *
     */
    function init() {

        // Initialize the container
        var container = document.getElementById( 'container' );
        stats = new Stats();
        container.appendChild( stats.dom );

        // Initialize the camera and its perspective
        camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 100 );
        camera.position.x = 12;
        camera.position.z = -8;
        camera.position.y = 8;

        // Initialize the scene
        scene = new THREE.Scene();

        // Add a point of light to cast shadows
        var bulbGeometry = new THREE.SphereBufferGeometry( 0.001, 16, 8 );
        bulbLight = new THREE.PointLight( 0xffee88, 1, 100, 2 );
        bulbMat = new THREE.MeshStandardMaterial( {
            emissive: 0xffffee,
            emissiveIntensity: 1,
            color: 0x000000
        });
        bulbLight.add( new THREE.Mesh( bulbGeometry, bulbMat ) );
        bulbLight.position.set( 0, 2, 0 );
        bulbLight.castShadow = true;
        scene.add( bulbLight );

        // Add hemispherical overall light
        hemiLight = new THREE.HemisphereLight( 0xddeeff, 0x0f0e0d, 0.02 );
        scene.add( hemiLight );

        // Add the floor for this simulation
        floorMat = new THREE.MeshStandardMaterial( {
            roughness: 0.9,
            color: 0x283747,
            metalness: 0.2,
            bumpScale: 0.0015
        });

        var textureLoader = new THREE.TextureLoader();
        var floorGeometry = new THREE.PlaneBufferGeometry( 20, 20 );
        var floorMesh = new THREE.Mesh( floorGeometry, floorMat );
        floorMesh.receiveShadow = true;
        floorMesh.rotation.x = -Math.PI / 2.0;
        scene.add( floorMesh );

        // Add the beam splitter cubes for this simulation
        cubeMat = new THREE.MeshStandardMaterial( {
            roughness: 0.7,
            color: 0x5dade2,
            bumpScale: 0.002,
            metalness: 0.2
        });

        var boxGeometry = new THREE.BoxBufferGeometry( 0.5, 0.5, 0.5 );
        var boxMesh1 = new THREE.Mesh( boxGeometry, cubeMat );
        boxMesh1.position.set( -2.5, 0.25, -2.5 );
        boxMesh1.castShadow = true;
        scene.add( boxMesh1 );
        var boxMesh2 = new THREE.Mesh( boxGeometry, cubeMat );
        boxMesh2.position.set( 2.5, 0.25, 2.5 );
        boxMesh2.castShadow = true;
        scene.add( boxMesh2 );

        // TODO: Add the mirrors - need to turn them to 45 degrees
        var planeMat = new THREE.MeshBasicMaterial( {
            color: 0xF8F9F9,
            side: THREE.DoubleSide,
            emissive: 0xffffee,
            emissiveIntensity: 1
        } );

        var planeGeometry = new THREE.PlaneBufferGeometry( 0.5, 0.5, 0.5 );
        var mirror1 = new THREE.Mesh( planeGeometry, planeMat);
        mirror1.position.set( -2.5, 0.25, 2.5 );
        mirror1.castShadow = true;
        scene.add( mirror1 );
        var mirror2 = new THREE.Mesh( planeGeometry, planeMat);
        mirror2.position.set( 2.5, 0.25, -2.5 );
        mirror2.castShadow = true;
        scene.add( mirror2 );

        // TODO: Add the screen
        var screenMat = new THREE.MeshBasicMaterial( {
            color: 0xF8F9F9,
            side: THREE.DoubleSide,
            emissive: 0xffffff,
            emissiveIntensity: 1
        } );

        var screenGeometry = new THREE.PlaneBufferGeometry( 1.5, 1.5, 1.5 );
        var screen1 = new THREE.Mesh( screenGeometry, screenMat);
        screen1.position.set( 2.5, 0.25, 5);
        screen1.castShadow = true;
        scene.add( screen1 );

        // TODO: Add the laser
        var laserMat = new THREE.MeshStandardMaterial( {
            roughness: 0.1,
            color: 0x17202a,
            metalness: 0.2,
            bumpScale: 0.0015
        } );

        var laserGeometry = new THREE.BoxBufferGeometry( 0.75, 0.75, 1.4 );
        var laser = new THREE.Mesh( laserGeometry, laserMat );
        laser.position.set( -2.5, 0.35, -5.5 );
        laser.castShadow = true;
        scene.add( laser );

        // Initialize the renderer
        renderer = new THREE.WebGLRenderer();
        renderer.physicallyCorrectLights = true;
        renderer.gammaInput = true;
        renderer.gammaOutput = true;
        renderer.shadowMap.enabled = true;
        renderer.toneMapping = THREE.ReinhardToneMapping;
        renderer.setPixelRatio( window.devicePixelRatio );
        renderer.setSize( window.innerWidth, window.innerHeight );
        container.appendChild( renderer.domElement );
        var controls = new THREE.OrbitControls( camera, renderer.domElement );
        window.addEventListener( 'resize', onWindowResize, false );

        // Add controls interface
        var gui = new dat.GUI();
        gui.add( params, 'hemiIrradiance', Object.keys( hemiLuminousIrradiances ) );
        gui.add( params, 'bulbPower', Object.keys( bulbLuminousPowers ) );
        gui.add( params, 'exposure', 0, 1 );
        gui.add( params, 'shadows' );
        gui.open();
    }

    /*
     * Renders the animation
     */
    function animate() {
        requestAnimationFrame( animate );
		render();
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( window.innerWidth, window.innerHeight );
    }

    var previousShadowMap = false;

    /*
     * Render lighting of the simulation
     */
	function render() {

        // Add some shadows to look realistic
		renderer.toneMappingExposure = Math.pow( params.exposure, 5.0 ); // to allow for very bright scenes.
		renderer.shadowMap.enabled = params.shadows;
		bulbLight.castShadow = params.shadows;

		if( params.shadows !== previousShadowMap ) {
			cubeMat.needsUpdate = true;
			floorMat.needsUpdate = true;
			previousShadowMap = params.shadows;
		}

		bulbLight.power = bulbLuminousPowers[ params.bulbPower ];
		bulbMat.emissiveIntensity = bulbLight.intensity / Math.pow( 0.02, 2.0 ); // convert from intensity to irradiance at bulb surface
		hemiLight.intensity = hemiLuminousIrradiances[ params.hemiIrradiance ];

		renderer.render( scene, camera );
		stats.update();
	}

});
