import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-rotatedmarker";
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./view.css";

import locIcon from "./images/locationIcon.png";
import planeLoc from "./images/plane.png";

const MissionPlannerMap = () => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [latitude, setLatitude] = useState(16.2729542);
    const [longitude, setLongitude] = useState(80.4375805);
    const [waypoints, setWaypoints] = useState([]);
    const [status, setStatus] = useState('connect');
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [batteryPercentage, setBatteryPercentage] = useState(null);
    const [battcolor, setBattcolor ] = useState(null);
    const [direction, setDirection] = useState('');
    const [yaw, setYaw] = useState(null);
    const [vehicleHeading, setVehicleHeading] = useState(0);
    const [degree, setDegree] = useState(null);
    const locationRef = useRef(null);
    const vehicleRef = useRef(null);
    var firstTime = true;
    const [distanceTraveled, setDistanceTraveled] = useState(null);
    const [disttohome, setdisttohome] = useState(null);
    const [altitude, setAltitude] = useState(null);
    const [airspeed, setAirspeed] = useState(null);
    const [connection, setConnection] = useState(null);
    const [selectedMode, setSelectedMode] = useState(null);
    const [armStatus, setArmStatus] = useState(false);
    const [websocket, setWebsocket] = useState(null);
  
    useEffect(() => {
      const fetchData = async () => {
        try {
          const response = await axios.get(
            "https://missionplanner-api.onrender.com/tdata-data"
          );
          setData(response.data);
          setLoading(false);
          setTimeout(fetchData, 50);
          const { lat, lng } = response.data?.Target?.input ?? {};
          if (lat !== undefined && lng !== undefined) {
            setLatitude(lat);
            setLongitude(lng);
          }
        } catch (error) {
          setLoading(false);
          setTimeout(fetchData, 5);
        }
      };
      fetchData();
      return () => clearTimeout(fetchData);
    });
    useEffect(() => {
      setBatteryPercentage(data?.Target?.input?.battery_remaining.toFixed(0));
      setAltitude(data?.Target?.input?.alt.toFixed(0));
      setDegree(parseInt(data?.Target?.input?.yaw));
      setYaw(data?.Target?.input?.yaw);
      setDistanceTraveled(data?.Target?.input?.distTraveled.toFixed(0));
      setdisttohome(data?.Target?.input?.DistToHome.toFixed(0));
      setAirspeed(data?.Target?.input?.airspeed.toFixed(1));
      setConnection(data?.Target?.input?.linkqualitygcs);
      
  
    }, [data]);
  
    var locationIcon = L.icon({
      iconUrl: locIcon,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -30],
    });
    var planeIcon = L.icon({
      iconUrl: planeLoc,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -30],
      rotationAngle: 0,
      rotationOrigin: "50% 50%",
    });
  
  
    useEffect(() => {
      if (map) return; // Prevent multiple initializations
    
      const leafletMap = L.map(mapRef.current).setView([latitude, longitude], 15);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(leafletMap);

      // L.control.zoom({ position: 'bottomright' }).addTo(mapRef.current);
    
      // Define drawnItems as a FeatureGroup to hold drawn shapes
      const drawnItems = new L.FeatureGroup();
      leafletMap.addLayer(drawnItems);
  
      const locationIcon = L.icon({
        iconUrl: locIcon,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30],
      });
    
      // Custom marker options to use the location icon
      const markerOptions = {
        icon: locationIcon,
        draggable: true, // Allow dragging the marker
      };
    
      // Initialize markers array
      const markers = [];
    
      leafletMap.on('click', function (event) {
        const latlng = event.latlng;
        const marker = L.marker(latlng, markerOptions).addTo(leafletMap);
        markers.push(marker);
  
        // Create a dropdown menu for mode selection
        const dropdown = createModeDropdown(marker);
        marker.bindPopup(dropdown).openPopup();
  
    
        // If there are at least two markers, create the polyline and prepare waypoints
        if (markers.length >= 2) {
          const latlngs = markers.map(marker => marker.getLatLng());
          const polyline = L.polyline(latlngs, { color: 'blue' }).addTo(leafletMap);
    
          // Optionally, you can bind a tooltip to the polyline showing the total distance
          const totalDistance = calculateTotalDistance(latlngs);
          polyline.bindTooltip(`Total Distance: ${totalDistance.toFixed(2)} meters`).openTooltip();
        }
      });
    
      setMap(leafletMap);
    
      return () => {
        leafletMap.remove(); // Cleanup map on unmount
      };
    }, []);
  
      // Function to create dropdown menu for mode selection
    function createModeDropdown(layer) {
        const select = document.createElement('select');
        select.innerHTML = `
          <option value="">Select Mode</option>
          <option value=16>WAYPOINT</option>
          <option value=17>LOITER_UNLIM</option>
          <option value=18>LOITER_TURNS</option>
          <option value=19>LOITER_TIME</option>
          <option value=20>RETURN_TO_LAUNCH</option>
          <option value=21>LAND</option>
          <option value=22>TAKEOFF</option>
          <option value=31>LOITER_TO_ALT</option>
          <option value=82>SPLINE_WAYPOINT</option>
          <option value=83>ALTITUDE_WAIT</option>
          <option value=84>VTOL_TAKEOFF</option>
          <option value=85>VTOL_LAND</option>
        `;
        select.addEventListener('change', function(event) {
          const modeId = event.target.value;
          const alt = getAltitudeFromUser(); // Fetch altitude inputted by the user
          const latlng = layer.getLatLng();
    
          // Append the waypoint data to the list
          const newWaypoint = {
            "frame": 3, 
            "Tag": "0",
            "id": parseInt(modeId),
            "p1": 0.0, 
            "p2": 0.0, 
            "p3": 0.0, 
            "p4": 0.0, 
            "lat": latlng.lat, 
            "lng": latlng.lng, 
            "alt": alt, // Altitude is already a string
          };
          console.log(newWaypoint)
          setWaypoints(prevWaypoints => [...prevWaypoints, newWaypoint]);
        });
    
        const popupContent = document.createElement('div');
        popupContent.appendChild(select);
        return popupContent;
      }
    
      useEffect(() => {
        console.log(waypoints); // Log the updated waypoints
      }, [waypoints]); // Run this effect whenever waypoints state changes
      
      // Function to calculate the total distance between points
      function calculateTotalDistance(latlngs) {
        let totalDistance = 0;
        for (let i = 0; i < latlngs.length - 1; i++) {
            const latlng1 = latlngs[i];
            const latlng2 = latlngs[i + 1];
            totalDistance += latlng1.distanceTo(latlng2);
        }
        return totalDistance;
      }
        
    
      // Function to send waypoints to the API
      async function sendWaypointsToAPI() {
        if (!Array.isArray(waypoints) || waypoints.length === 0) {
          console.error("Waypoints is empty or not an array");
          return;
        }
        try {
          // Filter out non-serializable values from waypoints
          const serializableWaypoints = waypoints.map(wp => ({
            frame: wp.frame,
            Tag: wp.Tag,
            id: wp.id,
            p1: wp.p1,
            p2: wp.p2,
            p3: wp.p3,
            p4: wp.p4,
            lat: wp.lat,
            lng: wp.lng,
            alt: wp.alt,
          }));
    
          // Replace the URL with your API endpoint
          console.log(serializableWaypoints);
          const response = await axios.post("https://missionplanner-api.onrender.com/waypoints", serializableWaypoints);
          console.log("Waypoints sent to the API:", response.data);
          
        } catch (error) {
          console.error("Error sending waypoints to the API:", error);
        }
     }
    
    function getAltitudeFromUser() {
        // Prompt the user for altitude input with a default value of 100
        const alt = parseFloat(window.prompt("Enter altitude (default: 100)", "100"));
      
        // Check if the input is a valid number
        return isNaN(alt) ? 0.0 : alt;
    }
    
    const handlePlanButtonClick = () => {
        sendWaypointsToAPI();
    };
    
    const handleConnectButtonClick = async () => {
        try {
          let newStatus = status === 'disconnect' ? 'connect' : 'disconnect';
          let response = await axios.post('https://missionplanner-api.onrender.com/connect', { status});
          setStatus(newStatus);
          console.log('Request sent successfully:', response.data);
        } catch (error) {
          console.error('Error sending request:', error);
        }
    };
  
    //battery
    useEffect(() => {
        // Update color based on percentage
        if (batteryPercentage <= 25) {
            setBattcolor('red')
        } else if (batteryPercentage > 25 && batteryPercentage<=50) {
            setBattcolor('orange')
        }
        else if (batteryPercentage > 75 && batteryPercentage<=100) {
            setBattcolor('rgb(0, 255, 0)')
        }
    }, [batteryPercentage]);
      
    useEffect(() => {
      // Function to determine direction based on yaw value
      const determineDirection = () => {
        if (yaw >= 315 || yaw < 45) {
          setDirection('North');
        } else if (yaw >= 45 && yaw < 135) {
          setDirection('East');
        } else if (yaw >= 135 && yaw < 225) {
          setDirection('South');
        } else if (yaw >= 225 && yaw < 315) {
          setDirection('West');
        }
      };
  
      // Call the function when yaw value changes
      determineDirection();
    }, [yaw]);
  
    useEffect(() => {
      // preventing adding marker again and again using the below line
      if (vehicleRef.current) return;
  
      // if map exists and lat, long are not null, then add marker
      if (map && latitude !== undefined && longitude !== undefined) {
        vehicleRef.current = L.marker([latitude, longitude], {
          icon: planeIcon,
        }).addTo(map);
      }
    }, [latitude, longitude]);
  
    useEffect(() => {
      if (firstTime && latitude === 0 && longitude === 0) {
        firstTime = !firstTime;
        return;
      }
  
      // Update map position when latitude or longitude changes
      if (map && latitude !== undefined && longitude !== undefined) {
        map.setView([latitude, longitude]);
  
        // if vehicle exists, then update its position
        if (vehicleRef.current) {
          vehicleRef.current.setLatLng([latitude, longitude]);
          vehicleRef.current.setRotationOrigin("center center");
        }
      }
    }, [map, latitude, longitude]);


    const [a, setA] = useState(null);
    const [b, setB] = useState(null);
    const [c, setC] = useState(null);
    const [d, setD] = useState(null);
    const [e, setE] = useState(null);

    const degrees = {};
    for (let i = 0; i < 361; i++) {
        degrees[i] = i;
    }       
    degrees[0] = "N";
    degrees[45] = "NE";
    degrees[90] = "E";
    degrees[135] = "SE";
    degrees[180] = "S";
    degrees[225] = "SW";
    degrees[270] = "W";
    degrees[315] = "NW";


    useEffect(() => {
      setA(degrees[(degree - 2 + 360) % 360]);
      setB(degrees[(degree - 1 + 360) % 360]);
      setC(degrees[degree % 360]);
      setD(degrees[(degree + 1) % 360]);
      setE(degrees[(degree + 2) % 360]);
    }, [degree]);
  
        useEffect(() => {
          setVehicleHeading(yaw);
        },[yaw]);
  
    useEffect(() => {
      // Update rotation angle when degree changes
      if (vehicleRef.current && degree !== undefined) {
        vehicleRef.current.setRotationAngle(vehicleHeading);
      }
    }, [vehicleHeading]);

    useEffect(() => {
      // Establish WebSocket connection when component mounts
      const WebSocket_URL = 'wss://helpful-yielding-work.glitch.me/';
      const ws = new WebSocket(WebSocket_URL);
  
      ws.onopen = () => {
        console.log('WebSocket connection established');
        setWebsocket(ws);
      };
  
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
  
      ws.onclose = () => {
        console.log('WebSocket connection closed');
        setWebsocket(null);
        setArmStatus('disarmed'); // Reset arm status
      };
  
      // Clean up function to close WebSocket connection when component unmounts
      return () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    }, []);
  
    const handleArmButtonClick = () => {
      // Toggle arm status
      const newStatus = armStatus ? 'disarmed' : 'armed';
      setArmStatus(!armStatus);
  
      // Send status change message over WebSocket if connection is open
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(newStatus);
        console.log(`Sent command: ${newStatus}`);
      }
    };

    
    const handleModeSelect = async (modes) => {
        try {
          
          // Create the mode payload
          const modePayload = { modes };

          // Log the payload for debugging purposes
          console.log(modePayload);
      
          // Send the modes payload to the API
          const response = await axios.post("https://missionplanner-api.onrender.com/modes", modePayload);
          console.log("Modes sent to the API:", response.data);
      
        } catch (error) {
          console.error("Error sending modes to the API:", error);
        }
      }
  
    const flightModes = [
      // Define flight modes and their associated colors
      { modes: 'Auto'},
      { modes: 'Stabilize' },
      { modes: 'Acro' },
      { modes: 'Alt Hold'},
      { modes: 'Guided'},
      { modes: 'Loiter'},
      { modes: 'RTL'},
      { modes: 'Circle'},
      { modes: 'Land'},
      { modes: 'Drift'},
      { modes: 'Sport'},
      { modes: 'Flip'},
      { modes: 'Autotune'},
      { modes: 'Pos Hold'},
      { modes: 'Break'},
      { modes: 'Throw'},
      { modes: 'Guided No GPS'},
      { modes: 'Smart RTL'},
      { modes: 'Flow Hold'},
      { modes: 'Follow'},
      { modes: 'Zigzag'},
      { modes: 'Auto RTL'}
    ];

    const [sigcolor1, setSigcolor1] = useState('green');
    const [sigcolor2, setSigcolor2] = useState('green');
    const [sigcolor3, setSigcolor3] = useState('green');
    const [sigcolor4, setSigcolor4] = useState('green');

        useEffect(() => {
            if (connection <= 25) {
                setSigcolor1('red')
                setSigcolor2('white')
                setSigcolor3('white')
                setSigcolor4('white')
            } else if (connection > 25 && connection<=50) {
                setSigcolor1('red')
                setSigcolor2('red')
                setSigcolor3('white')
                setSigcolor4('white')
            }
            else if (connection > 50 && connection<=75) {
                setSigcolor1('rgb(0, 255, 0)')
                setSigcolor2('rgb(0, 255, 0)')
                setSigcolor3('rgb(0, 255, 0)')
                setSigcolor4('white')
            }
            else if (connection > 75 && connection<=100) {
                setSigcolor1('rgb(0, 255, 0)')
                setSigcolor2('rgb(0, 255, 0)')
                setSigcolor3('rgb(0, 255, 0)')
                setSigcolor4('rgb(0, 255, 0)')
            }
        }, [connection]);

        const [polyLine, setPolyLine] = useState(null);
        const [wayPoints, setWayPoints] = useState([]);
        const [markers, setMarkers] = useState([]);
        let retryCount2=0;
      
        // creating path and adding markers on path
        useEffect(() => {
          if (wayPoints.length === 0) {
            if (map) {
              // Clear existing markers and polylines from the map
              if (markers.length > 0) {
                markers.forEach((marker) => map.removeLayer(marker));
                setMarkers([]); // Clear markers state
              }
              if (polyLine) {
                map.removeLayer(polyLine);
              }
            }
            return;
          }
      
          if (map) {
            // Clear existing markers and polylines from the map
            if (markers.length > 0) {
              markers.forEach((marker) => map.removeLayer(marker));
              setMarkers([]); // Clear markers state
            }
            if (polyLine) {
              map.removeLayer(polyLine);
            }
      
            const polyPoints = [];
            const newMarkers = [];
      
            wayPoints.forEach((dict) => {
              const { lat, lng } = dict;
              const marker = L.marker([lat, lng], { icon: locationIcon }).addTo(map);
              polyPoints.push([lat, lng]);
              newMarkers.push(marker);
            });
      
            // Add polyline to the map
            const newPolyLine = L.polyline(polyPoints, { color: "blue" }).addTo(map);
      
            // Update state with new markers and polyline
            setMarkers(newMarkers);
            setPolyLine(newPolyLine);
          }
        }, [wayPoints]);


        useEffect(() => {
          console.log("Waypoints:", wayPoints);
        }, [wayPoints]);
    
    
        const clearPath =async () => {
          if (map) {
            map.eachLayer(layer => {
              if (layer instanceof L.Polyline || layer instanceof L.Marker) {
                map.removeLayer(layer);
              }
            });
          }
    
          try {
            // Filter out non-serializable values from waypoints
            setWayPoints([]);
            markers.forEach((marker) => map.removeLayer(marker));
            setMarkers([]);
            map.removeLayer(polyLine);
            setPolyLine(null);
      
            // Replace the URL with your API endpoint
            console.log(wayPoints);
            const response = await axios.post("https://missionplanner-api.onrender.com/waypoints", []);
            console.log("Waypoints sent to the API:", response.data);
            
          } catch (error) {
            console.error("Error sending waypoints to the API:", error);
          }
        };
      
        // fetching waypoints
        useEffect(() => {
          let timerId;
      
          const fetchWayPoints = async () => {
            if (retryCount2 >= 100) {
              console.log("Maximum retries reached. Stopping further requests.");
              return;
            }
            try {
              const points = await axios.get(
                "https://missionplanner-api.onrender.com/waypoints-data"
              );
              setWayPoints(points.data);
              timerId = setTimeout(fetchWayPoints, 5);
            } catch (error) {
              console.log("Error from WayPoints");
              retryCount2++;
              timerId = setTimeout(fetchWayPoints, 5);
            }
          };
      
          fetchWayPoints();
      
          // Cleanup function to clear the timeout when the component unmounts
          return () => clearTimeout(timerId);
        }, []); // Empty dependency array to run effect only once on component mount
      
    
    return (
        <div className="drone-control-container">
          <div className="map-view" ref={mapRef}>
            {/* Display your map here */}
            {/* You can use libraries like Leaflet or Google Maps */}
          </div>

          <div className='Divtop'>
                <div className='Grbox' style={{height:'90%',width:'97%'}}>
                    <div className='Container' style={{width:'90%',justifyContent:'space-around'}}>
                        <div className='Colgrp'>
                            <div className='Texttop'>DISTANCE</div>
                            <div className='Textbox'>{distanceTraveled}</div>
                            <div className='Measures'>m</div>
                        </div>
                        <div className='Colgrp'>
                            <div className='Texttop'>DISTANCE TO HOME</div>
                            <div className='Textbox'>{disttohome}</div>
                            <div className='Measures'>m</div>
                        </div>
                        <div className="heading">
                            <div className="heading-arrow">
                                {/* <i className="ri-triangle-fill"></i> */}
                                {/* <img className="ri-triangle-fill" src={Triangle}></img>  */}
                                <div className='triangle-down'></div>
                            </div>
                            <div className="values">
                                <span className="val" style={{width:'10px', height:'10px'}}>{a}</span>
                                <span className="val" style={{width:'10px', height:'10px'}}>{b}</span>
                                <span className="val" style={{width:'10px', height:'10px'}}>{c}</span>
                                <span className="val" style={{width:'10px', height:'10px'}}>{d}</span>
                                <span className="val" style={{width:'10px', height:'10px'}}>{e}</span>
                            </div>
                        </div>
                        <div className='Colgrp'>
                            <div className='Texttop'>ALT</div>
                            <div className='Textbox'>{altitude}</div>
                            <div className='Measures'>m</div>
                        </div>
                        <div className='Colgrp'>
                            <div className='Texttop'>SPEED</div>
                            <div className='Textbox'>{airspeed}</div>
                            <div className='Measures'>m/s</div>
                        </div>
                        <div className='Colgrp'>
                        <div className='battery-group'>
                          <div className='battery-top'></div>
                            <div className='battery'>
                              <div className='battery-inline'>
                                <div className='battery-level' style={{backgroundColor: battcolor , height: `${batteryPercentage}%`}}></div>
                              </div>
                            </div>
                        </div>
                        </div>
                        <div className='Colgrp'style={{position:'absolute',left:'102.5%',top:'25%'}}>
                            <div className='Rowgrpsig' style={{height:'3vh',width:'1.5vw',marginBottom:'7px'}}>
                                <div style={{height:'25%',width:'15%',backgroundColor:sigcolor1}}></div>
                                <div style={{height:'50%',width:'15%',backgroundColor:sigcolor2}}></div>
                                <div style={{height:'75%',width:'15%',backgroundColor:sigcolor3}}></div>
                                <div style={{height:'100%',width:'15%',backgroundColor:sigcolor4}}></div>
                            </div>
                            <div className='Measures'>{connection}%</div>
                        </div>
                    </div>
                </div>
            </div>
          <div className="control-buttons">
          <button className={`connect-button ${status}`} onClick={handleConnectButtonClick}>
              {status === 'connect' ? 'Connect' : 'Disconnect'}
            </button>
            <div className="flight-mode-container">
            <p>Select a flight mode:</p>
            <div className="dropdown">
              <select
                onChange={(e) => {
                const selectedMode = e.target.value;
                setSelectedMode(selectedMode);
                handleModeSelect(selectedMode); // Call handleModeSelect with selected mode
              }}
              value={selectedMode}
              >
                {/* Render dropdown options based on flightModes array */}
                {flightModes.map((modeObj, index) => (
                <option key={index} value={modeObj.modes}>
                {modeObj.modes}
                </option>
                ))}
              </select>
            </div>
          </div>
        </div>

          <button className="plan-button" onClick={handlePlanButtonClick}>
              Plan
            </button>
            <button className="clear-path-button" onClick={clearPath}>
            Clear Path
          </button>
          <button className={armStatus ? "status-armed" : "status-disarmed"} onClick={handleArmButtonClick}>
            {armStatus ? 'DisArm' : 'Arm'}
          </button>
        </div>
      );
    };
export default MissionPlannerMap;