$(document).ready(function () {

    if (!Detector.webgl) {
        Detector.addGetWebGLMessage();
        document.getElementById('container').innerHTML = "";
    }

    /* global variables */
    var container;
    var camera, scene, renderer;

    // The material parameters for the floor, mirrors, beam splitter cubes, screen and sample
    var screenMat, cubeMat, floorMat, planeMat, laserMat, sampleMat, beamMat;

    // lighting variables
    var bulbLight, bulbMat, hemiLight;

    // Some dimensional parameters
    var position = 3;

    // Other variables that are needed (idk why)
    var stats;
    var previousShadowMap = false;

    // Variables for simulation
    var beams = [];
    var samples = [];

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

    // laser types and their properties
    var laserType = {
        "HeNe 543nm": {
            color: new THREE.Color( 0x2ecc71  ),
            wavelength: 543*Math.pow(10,-9)
        },
        "HeNe 594 nm": {
            color: new THREE.Color( 0xf7dc6f ),
            wavelength: 594*Math.pow(10,-9)
        },
        "HeNe 612 nm": {
            color: new THREE.Color( 0xe67e22 ),
            wavelength: 612*Math.pow(10,-9)
        },
        "HeNe 633 nm": {
            color: new THREE.Color( 0xe74c3c ),
            wavelength: 633*Math.pow(10,-9)
        }
    };

    // parameters to vary in interactive simulation
    var params = {
        // Static view parameters
        exposure: 0.8,
        hemiIrradiance: Object.keys( hemiLuminousIrradiances )[3],
        sampleAngle: 0,
        mirrorAngle: 0,
        shadows: true,
        bulbPower: Object.keys( bulbLuminousPowers )[ 4 ],
        laserType: Object.keys( laserType )[ 0 ],
        beamWidth: 2.0,
        refractiveIndex: 1,
        sampleAngle: 0.0
    }

    var clock = new THREE.Clock(); // keeps track of time

    // Colours for beam

    // Start the simulation
    init();
    animate();

    /*
     * Creates the scene by assigning scene, camera and renderer
     * Also creates all elements of the simulation
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
            color: 0x17202A,
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
            transparent: true,
            opacity: 0.5,
            roughness: 0.7,
            color: 0x5dade2,
            bumpScale: 0.002,
            metalness: 0.2
        });

        var boxGeometry = new THREE.BoxBufferGeometry( 0.5, 0.5, 0.5 );
        var boxMesh1 = new THREE.Mesh( boxGeometry, cubeMat );
        boxMesh1.position.set( -position, 0.5, -position );
        boxMesh1.castShadow = true;
        scene.add( boxMesh1 );
        var boxMesh2 = new THREE.Mesh( boxGeometry, cubeMat );
        boxMesh2.position.set( position, 0.5, position );
        boxMesh2.castShadow = true;
        scene.add( boxMesh2 );

        // TODO: Add the mirrors - need to turn them to 45 degrees
        var planeMat = new THREE.MeshBasicMaterial( {
            transparent: true,
            opacity: 0.6,
            reflectivity: 1.0,
            color: 0xF8F9F9,
            side: THREE.DoubleSide
        } );

        var planeGeometry = new THREE.CircleBufferGeometry( 0.5, 32 );;
        var mirror1 = new THREE.Mesh( planeGeometry, planeMat);
        mirror1.rotateY( -Math.PI / 4 );
        mirror1.position.set( -position, 0.5, position );
        mirror1.castShadow = true;
        scene.add( mirror1 );
        var mirror2 = new THREE.Mesh( planeGeometry, planeMat);
        mirror2.rotateY( -Math.PI / 4 );
        mirror2.position.set( position, 0.5, -position );
        mirror2.castShadow = true;
        scene.add( mirror2 );

        // TODO: Add the screen
        var screenMat = new THREE.MeshBasicMaterial( {
            color: 0xF8F9F9,
            side: THREE.DoubleSide
        } );

        var screenGeometry = new THREE.PlaneBufferGeometry( 1.5, 1.5, 1.5 );
        var screen1 = new THREE.Mesh( screenGeometry, screenMat);
        screen1.position.set( position, 0.5, position+2.5);
        screen1.castShadow = true;
        scene.add( screen1 );

        var screen2 = new THREE.Mesh( screenGeometry, screenMat);
        screen2.position.set( position+2.5, 0.5, position);
        screen2.rotateY( -Math.PI / 2 );
        screen2.castShadow = true;
        scene.add( screen2 );

        // TODO: Add the sample
        createSamples();

        // TODO: Add the laser source
        var laserMat = new THREE.MeshStandardMaterial( {
            roughness: 0.1,
            color: 0x17202a,
            metalness: 0.2,
            bumpScale: 0.0015
        } );

        var laserGeometry = new THREE.BoxBufferGeometry( 0.75, 0.75, 1.4 );
        var laser = new THREE.Mesh( laserGeometry, laserMat );
        laser.position.set( -position, 0.35, -position-2.5 );
        laser.castShadow = true;
        scene.add( laser );

        // Add the laser beams
        createBeams();

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
        initGui();
    }

    /*
     * Initializes and customizes the gui
     */
    function initGui() {
        var gui = new dat.GUI();

        function updateBeams() {
			clearBeams();
			createBeams();
    	}

        function updateSamples() {
            clearSamples();
            createSamples();
        }

        // folder 1: all of the view options
        var folder1 = gui.addFolder( 'View Parameters' );
        folder1.add( params, 'hemiIrradiance', Object.keys( hemiLuminousIrradiances ));
        folder1.add( params, 'bulbPower', Object.keys( bulbLuminousPowers ) );
        folder1.add( params, 'exposure', 0, 1 );
        folder1.add( params, 'shadows' );

        // folder 2: all of the view options
        var folder2 = gui.addFolder( 'Laser Parameters' );
        folder2.add( params, 'beamWidth', 0.0, 5.0, 0.5).onChange( updateBeams );
        folder2.add( params, 'laserType', Object.keys( laserType ) ).onChange( updateBeams );

        var folder3 = gui.addFolder( 'Sample Parameters' );
        folder3.add( params, 'refractiveIndex', 0.0, 1.8, 0.1 ).onChange( updateSamples );
        folder3.add( params, 'sampleAngle', -45.0, 45.0, 2.0 ).onChange( updateSamples );

        // open the folders for them to take into effect
        folder1.open();
        folder2.open();
        folder3.open();

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

    function clearSamples() {
        samples.forEach( function ( l ) {
            scene.remove( l );
        });
        samples = [];
    }

    function clearBeams() {
        beams.forEach( function ( l ) {
            scene.remove( l );
        });
        beams = [];
    }

    function createSamples() {
        var sampleMat = new THREE.MeshStandardMaterial( {
            transparent: true,
            opacity: params.refractiveIndex / 2,
            roughness: 0.7,
            color: 0xec7063,
            bumpScale: 0.002,
            metalness: 0.2
        });

        var sampleGeometry = new THREE.BoxBufferGeometry( 0.75, 0.55, 0.1 );
        var sample = new THREE.Mesh( sampleGeometry, sampleMat );
        sample.position.set( -position, 0.4, 0 );
        sample.rotateY( (params.sampleAngle * Math.PI)/180);
        sample.castShadow = true;
        scene.add( sample );
        samples.push( sample );
    }

    function createBeams() {
        var beamMat = new MeshLineMaterial({
            color: laserType[params.laserType].color,
            opacity: 0.7,//params.strokes ? .5 : 1,
            lineWidth: params.beamWidth,
            transparent: true,
            side: THREE.DoubleSide,
            needsUpdate: true
        });

        //Beam 1
        var beam1Geometry = new THREE.Geometry();
        beam1Geometry.vertices.push(
            new THREE.Vector3( -position, 0.35, -position-2.5 ),
            new THREE.Vector3( -position, 0.4, -position ),
            new THREE.Vector3( -position, 0.5, position ),
            new THREE.Vector3( position, 0.4, position ),
            new THREE.Vector3( position, 0.5, position+2.5)
        );
        beam1Geometry.buffersNeedUpdate = true;
        var beam1 = new MeshLine();
        beam1.setGeometry( beam1Geometry, function( p ) { return 0.1*p } );
        var beam1Mesh = new THREE.Mesh( beam1.geometry, beamMat );
        scene.add( beam1Mesh );
        beams.push( beam1Mesh );

        // Beam 2
        var beam2Geometry = new THREE.Geometry();
        beam2Geometry.vertices.push(
            new THREE.Vector3( -position, 0.35, -position-2.5 ),
            new THREE.Vector3( -position, 0.4, -position ),
            new THREE.Vector3( position, 0.5, -position ),
            new THREE.Vector3( position, 0.4, position ),
            new THREE.Vector3( position+2.5, 0.5, position)
        );
        var beam2 = new MeshLine();
        beam2.setGeometry( beam2Geometry, function( p ) { return 0.1*p } );
        var beam2Mesh = new THREE.Mesh( beam2.geometry, beamMat );

        scene.add( beam2Mesh );
        beams.push( beam2Mesh );

    }

    /*
     * Function to get the centre point of the object
     * To get the change in phase.
     */
    function getCenterPoint(mesh) {
        var geometry = mesh.geometry;
        geometry.computeBoundingBox();
        center = geometry.boundingBox.getCenter();
        mesh.localToWorld( center );
        return center;
    }


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

        if ( beamMat !== undefined ) {
            beamMat.lineWidth = params.beamWidth;
        }

		bulbLight.power = bulbLuminousPowers[ params.bulbPower ];
		bulbMat.emissiveIntensity = bulbLight.intensity / Math.pow( 0.02, 2.0 ); // convert from intensity to irradiance at bulb surface
		hemiLight.intensity = hemiLuminousIrradiances[ params.hemiIrradiance ];

		renderer.render( scene, camera );
		stats.update();
	}
});
