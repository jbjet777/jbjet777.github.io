/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

"use strict";

class EasyMap
{
    constructor(refTarget, refZoom, coordinates)
    {
        var MAX_ZOOM = 28;
        var MIN_ZOOM = 0;
        var ONLINE_MAP = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
        var OFFLINE_MAP = 'images/offline/{z}/{x}/{y}.jpg';
        var firstDragCoord = null;
        var lastDragCoord = null;
        var dragEndCallBack = null;
        var dragStartCallBack = null;
        var redrawCallBack = null;
        var mapClickCallBack = null;
        var mapDoubleClickCallback = null;
        var isZooming = false;
        var callDragStartOnce = true;
        
        var interAct = ol.interaction.defaults({
            altShiftDragRotate: false,
            pinchRotate: false,
            shiftDragZoom: false});
        
        var view = new ol.View(
                {
                     center: ol.proj.fromLonLat([coordinates.longitude, coordinates.latitude]),
                     zoom: refZoom
                });
                
        var drawSource = new ol.source.Vector({ wrapX: true});
        
        var map = new ol.Map(
                {
                    target: refTarget,
                    layers: [new ol.layer.Tile(
                            {
                                source: new ol.source.OSM({url: ONLINE_MAP})
                            })],
                    view: view,
                    controls: [],
                    interactions: interAct,
                    loadTilesWhileAnimating: true,
                    loadTilesWhileInteracting: true
                });
                
        var drawLayer = new ol.layer.Vector({
                                source: drawSource,
                                style: new ol.style.Style({stroke: new ol.style.Stroke({color: 'black', width: 2})}),
                                updateWhileAnimating: true,
                                updateWhileInteracting: true,
                                renderBuffer: 2000
                            });
        
        map.addLayer(drawLayer);
        
        var lastLeftLong = getBounds().bottomLeft.longitude;
        var lastRightLong = getBounds().topRight.longitude;
        
        /*
         * Makes sure value is inside circle 360.0 degrees!
         * @param {Number} value
         * @returns {Number}
         */
        function rev(/* Number */ value)
        {
            if (value > 360.0 || value < 0.0)
            {
                return (value - (Math.floor(value / 360.0) * 360.0));
            }
            
            if(value > 180)
            {
                value -= 360;
            }

            return value;
        }
        
        /*
         * Convert an array of javaScript Coordinates to OpenLayer point array.
         * @param {Coordinates} coords -- Array of javaScript Coordinates
         * @returns {Array|EasyMap.constructor.coordsToOpenLayers.points}
         */
        function coordinatesToOpenLayers(coords)
        {
            var points = [];
            var lastLong = 0;
            var longFix = 0;
            var fixedLong = 0;
            var leftLong = getBounds().bottomLeft.longitude;
                                                            
            for (var i = 0; i < coords.length; i++)
            {
                if(i === 0 && typeof(leftLong) === 'number') // To get large polygons to display correctly use coordinate "system" of the left side of the current view.
                {
                    if (leftLong > 90 && coords[i].longitude < -90)
                    {
                        longFix = 360;
                    } else if (leftLong < -90 && coords[i].longitude > 90)
                    {
                        longFix = -360;
                    }
                }               
                if (i > 0 && longFix === 0)
                {
                    if (lastLong > 90 && coords[i].longitude < -90)
                    {
                        longFix = 360;
                    } else if (lastLong < -90 && coords[i].longitude > 90)
                    {
                        longFix = -360;
                    }
                }
               
                fixedLong = coords[i].longitude + longFix;
                
                if(fixedLong > 360)
                {
                    fixedLong -= 360;
                }
                if(fixedLong < -360)
                {
                    fixedLong += 360;
                }
                                
                points.push([fixedLong, coords[i].latitude]);
                lastLong = coords[i].longitude;
            }
            
             return points;
        }
        
        /*
         * Splits big array into small arrays.
         * @param {Array} arr -- Array to be split
         * @param {Number} chunkSize - How big each smaller array should be.
         * @returns {Array}
         */
        function chunckArray(arr, chunkSize) 
        {
            var groups = [], i;
            
            for (i = 0; i < arr.length; i += chunkSize) 
            {
                groups.push(arr.slice(i, i + chunkSize));
            }
            
            return groups;
        }
        
        /*
         * Convert an array of javaScript Coordinates to OpenLayer point array.
         * @param {Coordinates} coords -- Array of javaScript Coordinates
         * @returns {Array|EasyMap.constructor.coordsToOpenLayers.points}
         */
        function coordinatesToOpenLayers2(coords)
        {
            var points = [];
                      
            for (var i = 0; i < coords.length; i++)
            {                               
                points.push([coords[i].longitude, coords[i].latitude]);
            }
            
            return points;
        }
        
        /* Creates a great circle between 
         * Two inputed coordinate points.
         * @param {Position} pos1
         * @param {Position} pos2
         * @returns {EasyMap.addGreatCircle.polyLine|EasyMap@call | null}
         */
        this.addGreatCircle = function(pos1, pos2)
        {
            var coords = [];
            var generator = new arc.GreatCircle({x: pos1.longitude, y: pos1.latitude}, {x: pos2.longitude, y: pos2.latitude});
            var line = generator.Arc(50, {offset: 10});
            for(var x = 0; x < line.geometries.length; x++)
            {
                for(var y = 0; y < line.geometries[x].coords.length; y++)
                {
                    var pos = new Position(line.geometries[x].coords[y][1], line.geometries[x].coords[y][0]);
                    if(isNaN(pos.latitude) || isNaN(pos.longitude))
                    {
                        return null;
                    }
                    coords.push(pos);
                }
            }
            
            if(coords.length > 1)
            {
                var polyLine = this.addPolyLine(coords);
                               
                return polyLine;
            }
            else
            {
                console.log("Not enough points created for great circle line.");
            }
            
            return null;
        };
        
        /*
         * Add a polyline to the map.  Returns handle to feature or null on failure.
         * @param {Array} coords - Array of coordinates for line.
         * @returns {ol.Feature | null}  
         */
        this.addPolyLine = function(coords)
        {
            if(coords)
            {
                var points = coordinatesToOpenLayers(coords);
                
                var lineString = new ol.geom.LineString(points);
                lineString.transform('EPSG:4326', 'EPSG:3857');
                
                var feature = new ol.Feature({
                    geometry: lineString
                });
            
                drawSource.addFeature(feature);
                
                feature.reDraw = function()
                {
                    feature.setCoordinates(coords);
                }; 
                
                feature.setCoordinates = function(coords)
                {
                    var points = coordinatesToOpenLayers(coords);
                    var lineString = new ol.geom.LineString(points);
                    lineString.transform('EPSG:4326', 'EPSG:3857');
                    
                    this.setGeometry(lineString);                    
                };
                            
                return feature;            
            }
            
            return null;
        };
        
        /*
         * Returns an array of line features created from a large amount of coordinates.
         * @param {Array} coords - Array of Positions to draw
         * @returns {Array}
         */
        this.addMultiPolyLine = function(coords)
        {
            var lineArray = [];
            
            if(coords)
            {
                var multiCoords = chunckArray(coords, 100);
                
                for(var i = 0; i < multiCoords.length; i++)
                {
                    if(i <  (multiCoords.length - 1))
                    {
                       multiCoords[i].push(multiCoords[i + 1][0]);
                    }
                    lineArray.push(this.addPolyLine(multiCoords[i]));
                }
            }
            
            lineArray.reDraw = function()
            {
                for(var i = 0; i < lineArray.length; i++)
                {
                    if(lineArray[i])
                    {
                        lineArray[i].reDraw();
                    }
                }
            };
                        
            lineArray.isValid = function()
            {
                if(lineArray.length > 1)
                {
                    return true;
                }
                return false;
                    
            };
            
            return lineArray;
        };
        
        this.addPolygon = function(coords, options)
        {
            if(coords)
            {
                var fillColor = 'rgba(0, 0, 0, .5)';
                var strokeColor = 'black';
                var strokeWidth = 0.1;
                
                var fill = new ol.style.Fill();
                
                if(options)
                {
                    if(options.fill_color)
                    {
                        fillColor = options.fill_color;
                    }
                    if(options.stroke_color)
                    {
                        strokeColor = options.stroke_color;
                    }
                    if(typeof(options.stroke_width) === "number")
                    {
                        strokeWidth = options.stroke_width;
                    }
                }
                
                var style = new ol.style.Style(
                    {
                        stroke: new ol.style.Stroke(
                        {
                            color: strokeColor,
                            width: strokeWidth
                        }),
                        fill: new ol.style.Fill(
                        {
                            color: fillColor
                        })
                    });
                
                var points = coordinatesToOpenLayers(coords);
               
                var lineRing = new ol.geom.LinearRing(points);
                lineRing.transform('EPSG:4326', 'EPSG:3857');
                
                var polygon = new ol.geom.Polygon();
                polygon.appendLinearRing(lineRing);
                               
                var feature = new ol.Feature({
                    geometry: polygon
                });
                
                feature.setStyle(style);
                
                drawSource.addFeature(feature);
                
                feature.setCoordinates = function(coords)
                {
                    var points = coordinatesToOpenLayers(coords);
                    var lineRing = new ol.geom.LinearRing(points);
                    lineRing.transform('EPSG:4326', 'EPSG:3857');
                    var polygon = new ol.geom.Polygon();
                    polygon.appendLinearRing(lineRing);
                    this.setGeometry(polygon);                    
                };
                                          
                return feature;            
            }
            
            return null;
        };
        
        /* Add a marker to the map. 
         * @param {Coordinate} coords -- Coordinates of marker.
         * @param {String} imgSrc -- Image URL
         * @returns {ol.Feature}
         */
        this.addMarker = function(coords, imgSrc)
        {
            var iconStyle = new ol.style.Style(
                    {
                        image: new ol.style.Icon(
                        {
                            src: imgSrc
                        })
                    });
                    
            var point = new ol.geom.Point([coords.longitude, coords.latitude]);
            point.transform('EPSG:4326', 'EPSG:3857');
            
            var iconFeature = new ol.Feature(
                    {
                        geometry: point
                    });
                    
            iconFeature.setStyle(iconStyle);
            
            drawSource.addFeature(iconFeature);
            
            iconFeature.setLocation = function(coords)
            {
                var point = new ol.geom.Point([coords.longitude, coords.latitude]);
                point.transform('EPSG:4326', 'EPSG:3857');
                
                this.setGeometry(point);
            };
            
            return iconFeature;
        };
        
        /*
         * Returns the center of the current map view.
         * @returns {Position}
         */
        this.getCenter = function()
        {
            var center = ol.proj.transform(view.getCenter(), 'EPSG:3857', 'EPSG:4326');
            
            return new Position(center[1], center[0]);
        };
        
        /*
         * Returns the bottom left and top right corner positions on the current view of the map.
         * @returns {Object} - {bottomLeft: {Postion}, topRight: {Position}
         */
        function getBounds()
        {
            var viewExtent = view.calculateExtent(map.getSize());
            var bL = ol.proj.transform([viewExtent[0], viewExtent[1]], 'EPSG:3857', 'EPSG:4326');
            var tR = ol.proj.transform([viewExtent[2], viewExtent[3]], 'EPSG:3857', 'EPSG:4326');
            
            return{
                bottomLeft: new Position(bL[1], bL[0]),
                topRight: new Position(tR[1], tR[0])
            };
        };
        
        /*
         * Remove a feature (Polyline, polygon, etc. from map. 
         * @param {ol.Feature} feature
         * @returns {null}
         */
        this.removeFeature = function(feature)
        {
            if(feature)
            {
                if(Array.isArray(feature))
                {
                    while(feature.length > 0)
                    {
                        drawSource.removeFeature(feature.pop());
                    }
                    
                    return feature;
                }
                drawSource.removeFeature(feature);
            }
            
            return null;
        };
        
        /*
         * Re-render map.
         * @returns {undefined}
         */
        this.render = function()
        {
            map.render();
        };
        
        /*
         * Clears the map of all drawn features.
         * @returns {undefined}
         */
        this.clearMap = function()
        {
            drawSource.clear(true);
        };
                
        map.on("pointermove", function(ev)
        {
            if(ev.dragging)
            {
                if(!firstDragCoord)
                {
                    firstDragCoord = ev.pixel;
                }
            
                lastDragCoord = ev.pixel;
                
                if(dragStartCallBack)
                {
                    if(callDragStartOnce)
                    {
                        callDragStartOnce = false;
                        dragStartCallBack(ev);
                    }
                }
            }
        });
        
        map.on("moveend", function(ev)
        {
            console.log("MOVE END");
            
            var leftLong = getBounds().bottomLeft.longitude;
            var rightLong = getBounds().topRight.longitude;
            
            if(redrawCallBack) // Check if the left corner of view crossed a change over point to trigger redraw of polygons.
            {
                if(lastLeftLong > 0 && leftLong < 0)
                {
                    redrawCallBack(ev);
                }
                else if(lastLeftLong < 0 && leftLong > 0)
                {
                    redrawCallBack(ev);
                }
                else if(lastLeftLong < -180 && leftLong > -180)
                {
                    redrawCallBack(ev);
                }
                else if(lastLeftLong > -180 && leftLong < -180)
                {
                    redrawCallBack(ev);
                }
                else if(lastLeftLong > 180 && leftLong < 180)
                {
                    redrawCallBack(ev);
                }
                else if(lastLeftLong < 180 && leftLong > 180)
                {
                    redrawCallBack(ev);
                }
                
                if(lastRightLong > 0 && rightLong < 0)
                {
                    redrawCallBack(ev);
                }
                else if(lastRightLong < 0 && rightLong > 0)
                {
                    redrawCallBack(ev);
                }
                else if(lastRightLong < -180 && rightLong > -180)
                {
                    redrawCallBack(ev);
                }
                else if(lastRightLong > -180 && rightLong < -180)
                {
                    redrawCallBack(ev);
                }
                else if(lastRightLong > 180 && rightLong < 180)
                {
                    redrawCallBack(ev);
                }
                else if(lastRightLong < 180 && rightLong > 180)
                {
                    redrawCallBack(ev);
                }
            }
            lastLeftLong = leftLong;
            lastRightLong = rightLong;
            
            callDragStartOnce = true;
            if(firstDragCoord && lastDragCoord)
            {
                if(dragEndCallBack)
                {
                    var distance = 0;
                    if(!isZooming)
                    {
                        var a = firstDragCoord[0] - lastDragCoord[0];
                        var b = firstDragCoord[1] - lastDragCoord[1];
                        a *= a;
                        b *= b;
               
                        distance = Math.sqrt(a + b);
                    }
                    else
                    {
                        isZooming = false;
                    }
                    ev.distance = Math.round(distance);
                    dragEndCallBack(ev);
                }
            }

           firstDragCoord = null;
           lastDragCoord = null;
        });
        
        function mapClick(ev)
        {
           if(mapClickCallBack)
           {
               var clickPlace = ol.proj.toLonLat(ev.coordinate);

               mapClickCallBack(new Position(clickPlace[1], clickPlace[0]));
           } 
        }
        
        this.onDoubleClick = function(callback)
        {
            mapDoubleClickCallback = callback;
            
            map.on("doubleclick", mapDoubleClickCallback);
        };
        
        this.onClick = function(callback)
        {
           mapClickCallBack = callback;
           map.on("singleclick", mapClick);
        };
        
        this.clickOff = function()
        {
            if(mapClickCallBack)
            {
                map.un("singleclick", mapClick);
                mapClickCallBack = null;
            }
        };
        
        this.doubleClickOff = function()
        {
            if(mapDoubleClickCallback)
            {
                map.un("doubleclick", mapDoubleClickCallback);
                mapDoubleClickCallback = null;
            }
        };
        
        this.onDragEnd = function(callback)
        {
            dragEndCallBack = callback;
        };
        
        this.onDragStart = function(callback)
        {
            dragStartCallBack = callback;            
        };
        
        this.onRedrawCall = function(callback)
        {
            redrawCallBack = callback;
        };
        
        this.on = function(event, func, thisref)
        {
            return map.on(event, func, thisref);
        };
        
        this.onZoomEnd = function(func, thisRef)
        {
            return view.on("change:resolution", function(ev)
            {
                isZooming = true;
                map.once("moveend", func, thisRef);                
            }, thisRef);
        };
        
        this.updateSize = function()
        {
            map.updateSize();
        };
                
        this.zoomIn = function()
        {
            if(view.getZoom() < MAX_ZOOM)
            {
                view.setZoom(view.getZoom() + 1);
            }
        };
        
        this.zoomOut = function()
        {
            if(view.getZoom() > MIN_ZOOM)
            {
                view.setZoom(view.getZoom() - 1);
            }
        };
        
        this.setCenter = function(coords)
        {
            if(coords)
            {
                view.setCenter(ol.proj.fromLonLat([coords.longitude, coords.latitude]));
            }
        };
        
        /*
         * Zooms map to inputed value.
         * @param {Number} zoomVal - Value of zoom to set.
         * @returns {undefined}
         */
        this.setZoom = function(zoomVal)
        {
            if(typeof(zoomVal) === "number")
            {
                if(zoomVal > MAX_ZOOM)
                {
                    view.setZoom(MAX_ZOOM);
                }
                else if(zoomVal < MIN_ZOOM)
                {
                    view.setZoom(MIN_ZOOM);
                }
                else
                {
                    view.setZoom(zoomVal);
                }
            }
            else
            {
                throw "setZoom needs a number value input.";
            }
        };
        
        this.getZoom = function()
        {
            return view.getZoom();
        };
        
        this.getMaxZoom = function()
        {
            return MAX_ZOOM;
        };
        
        this.getMinZoom = function()
        {
            return MIN_ZOOM;
        };
    }
}

class LineWorkers
{
    constructor(func)
    {
        if(typeof(func) !== "function")
        {
            throw "Must use callback function in consctructor.";
        }
        var m_eclipse = null;
        var callback = func;
        var northPenumbraDone = false;
        var southPenumbraDone = false;
        
        var centralLineWorker = new Worker("calculateWorker.js");
        var northernUmbraLineWorker = new Worker("calculateWorker.js");
        var southernUmbraLineWorker = new Worker("calculateWorker.js");

        var southernPenumbraLineWorker = new Worker("calculateWorker.js");
        var northernPenumbraLineWorker = new Worker("calculateWorker.js");
        var eastEclipseLineWorker = new Worker("calculateWorker.js");
        var westEclipseLineWorker = new Worker("calculateWorker.js");
        
        centralLineWorker.onmessage = onLineWorkerMsg;
        northernUmbraLineWorker.onmessage = onLineWorkerMsg;
        southernUmbraLineWorker.onmessage = onLineWorkerMsg;
        
        southernPenumbraLineWorker.onmessage = onLineWorkerMsg;
        northernPenumbraLineWorker.onmessage = onLineWorkerMsg;
        eastEclipseLineWorker.onmessage = onLineWorkerMsg;
        westEclipseLineWorker.onmessage = onLineWorkerMsg;
        
        function onLineWorkerMsg(msg)
        {
            var data = msg.data;
            var southPenLine = "null";
            var northPenLine = "null";
            
            switch (data.cmd)
            {
                case 'eclipse_central_line_update':
                    callback({  type: 'central_line', 
                                line: JSON.parse(data.line),
                                times: JSON.parse(data.times)});
                    break;
                
                case 'eclipse_north_umbra_line_update':
                    callback({  type: 'north_umbra_line', 
                                line: JSON.parse(data.line),
                                times: JSON.parse(data.times)});
                    break;
                    
                case 'eclipse_south_umbra_line_update':
                    callback({  type: 'south_umbra_line',
                                line: JSON.parse(data.line),
                                times: JSON.parse(data.times)});
                    break;
                    
                case 'eclipse_south_penumbra_line_update':
                    southPenLine = data.line;
                    southPenumbraDone = true;                    
                    if(northPenumbraDone)
                    {
                        southPenumbraDone = false;
                        northPenumbraDone = false;
                        eastEclipseLineWorker.postMessage({ 'cmd': 'east_penumbra_line', 
                                                            'eclipse': m_eclipse,
                                                            'south_pen_line': southPenLine,
                                                            'north_pen_line': northPenLine});
                        westEclipseLineWorker.postMessage({ 'cmd': 'west_penumbra_line', 
                                                            'eclipse': m_eclipse,
                                                            'south_pen_line': southPenLine,
                                                            'north_pen_line': northPenLine});                         
                    }
                    callback({  type: 'south_penumbra_line',
                                line: JSON.parse(data.line)});
                    break;
                    
                case 'eclipse_north_penumbra_line_update':
                    northPenLine = data.line;
                    northPenumbraDone = true;                    
                    if(southPenumbraDone)
                    {
                        southPenumbraDone = false;
                        northPenumbraDone = false;
                        eastEclipseLineWorker.postMessage({ 'cmd': 'east_penumbra_line', 
                                                            'eclipse': m_eclipse,
                                                            'south_pen_line': southPenLine,
                                                            'north_pen_line': northPenLine});
                        westEclipseLineWorker.postMessage({ 'cmd': 'west_penumbra_line', 
                                                            'eclipse': m_eclipse,
                                                            'south_pen_line': southPenLine,
                                                            'north_pen_line': northPenLine});                         
                    }
                    callback({  type: 'north_penumbra_line',
                                line: JSON.parse(data.line)});
                    break;
                    
                case 'eclipse_east_penumbra_line_update':
                    callback({  type: 'east_penumbra_line',
                                line: JSON.parse(data.line),
                                times: JSON.parse(data.times)
                            });
                    break;
                    
                case 'eclipse_west_penumbra_line_update':
                    callback({  type: 'west_penumbra_line',
                                line: JSON.parse(data.line),
                                times: JSON.parse(data.times)});
                    break;
                    
                // ERROR CASES:    
                    
                case 'eclipse_central_line_error':
                    console.log("LINE WORKER: Central line error.");
                    break;
                
                case 'eclipse_north_umbra_line_error':
                    console.log("LINE WORKER: North umbra line error.");
                    break;
                    
                case 'eclipse_south_umbra_line_error':
                    console.log("LINE WORKER: South ubmra line error.");
                    break;
                    
                case 'eclipse_south_penumbra_line_error':
                    console.log("LINE WORKER: South penumbra line error.");
                    break;
                    
                case 'eclipse_north_penumbra_line_error':
                    console.log("LINE WORKER: North penumbra line error.");
                    break;
                    
                case 'eclipse_east_penumbra_line_error':
                    console.log("LINE WORKER: East penumbra line error.");
                    break;
                    
                case 'eclipse_west_penumbra_line_error':
                    console.log("LINE WORKER: West penumbra line error.");
                    break;
                    
                default:
                    console.log("LINE WORKER: Invalid line command.");
                    break;                    
            }
        }
         
        this.updateLines = function(eclipse)
        {
            m_eclipse = eclipse;
            northPenumbraDone = false;
            southPenumbraDone = false;
            
            centralLineWorker.postMessage({'cmd': 'central_line', 'eclipse': eclipse});
            northernUmbraLineWorker.postMessage({'cmd': 'north_umbra_line', 'eclipse': eclipse});
            southernUmbraLineWorker.postMessage({'cmd': 'south_umbra_line', 'eclipse': eclipse});
            
            southernPenumbraLineWorker.postMessage({'cmd': 'south_penumbra_line', 'eclipse': eclipse});
            northernPenumbraLineWorker.postMessage({'cmd': 'north_penumbra_line', 'eclipse': eclipse});                       
        };
    }
}

class EclipseUI
{
    constructor()
    {
        var MAP_PAGE_IDX = 1;
        var SIM_PAGE_IDX = 2;
        var TOAST_TIMEOUT = 2000;
        var TIME_LOCALE = "en-US";
        var LINE_COUNT = 7;
        var DATE_OPTIONS = {timeZone: "UTC", year: "numeric", month: "long", day: "numeric"};
        var MAP_OPTIONS = {zoomControl: false, worldCopyJump: true};   // TODO: Turn on world copy jump, does not work properly as of Leaflet 1.0.2
        var STARTING_COORDS = {latitude: 34, longitude: -118, altitude: 0};
        var LOCATION_MARKER_URL = 'images/loc24.png';
        
        var MID_SELECTION = 0;
        var C1_SELECTION = 1;
        var C2_SELECTION = 2;
        var C3_SELECTION = 3;
        var C4_SELECTION = 4;
        
        var simulationSelection = MID_SELECTION;
        
        var RUN_BEFORE = "run_before";
        var IMGS_FOLDER = 'images/';
        var MASTER_TIMER_INTERVAL = 1000;
        var START_COORDS = [34, -118];
        var START_ZOOM = 2;
        var IGNORE_DRAG = 15;   // If drag movement is small, keep location centered.
        var METERS_TO_FEET = 3.28084;
        
        var timeZone = new TimeZone;
        var selectedTimeZone = "";
        var localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        var material = new MaterialAddons;
        var eclipseCatalog = new Eclipses();
        var map = new EasyMap('map', 4, STARTING_COORDS);
        var eclipseLoadWorker = null;
        var currentEclipseRef = null;
        var mapSearchData = null;
        
        var positionWatch = new WatchPosition;
        var currentCoords = STARTING_COORDS;
        var currentAltitude = 0.0;
        var dateOffset = 0; // TODO: Time travel functionality.
        
        var sunRiseTime = null;
        var sunSetTime = null;
        var c1Time = null;
        var c2Time = null;
        var midTime = null;
        var c3Time = null;
        var c4Time = null;
        var visibleArray = null;
        
        var moonPos = 0;
        var sunPos = 0;
        
        var selectedEclipse = -1;
        var nextVisibleEclipse = -1;
        var longCickFired = false; // Set true during map click press, long presses are not clicks, so ignore them.
        var mapPositionLock = true;
        var tempIgnoreLock = false;
               
        var jMap = $("#map");
                
        var simulationTab = $("#simulation-tab");
        var sun = $("#sun");
        var moon = $("#moon");
        var eclipseList = $("#eclipse_list");
        var eclipseTitle = $("#eclipse-title");
        var eclipseTitleDate = $("#eclipse-title-date");
        var nextButton = $("#next-button");
        var visibleButton = $("#visible-button"); // TODO: Visible button functionality.
        var snackBar = document.querySelector("#snackbar");
        var mapLocationButton = $("#map-location-button");
        var mapZoomInButton = $("#map-zoom-in-button");
        var mapZoomOutButton = $("#map-zoom-out-button");
        var mapSection = $("#map-tab");
        var mapButtons = $("#map-buttons");
        var zoomButtons = $("#zoom-buttons");
        
        /* Map/Sim Menu */
        var mapMenuButton = $("#map-menu-button");
        var animateShadowMenuItem = $("#animate-shadow");
        var realtimeShadowMenuItem = $("#realtime-animate");
        var firstContactItem = $("#first-contact-sim");
        var secondContactItem = $("#second-contact-sim");
        var midEclipseItem = $("#mid-eclipse-sim");
        var thirdContactItem = $("#third-contact-sim");
        var fourthContactItem = $("#fourth-contact-sim");
        /* Map/Sim Menu End */
        
        var localTimeDiv = $("#local-time-pop");
        var zuluTimeDiv = $("#zulu-time-pop");
        var localAnimateTime = $("#local-animate-time");
        var zuluAnimateTime = $("#zulu-animate-time");
        var realTimeInfoID = $("#realtime-shadow");
        var contactPointID = $("#contact-point");
        var mapMenuID = $("#map-menu");
        var locationIcon = $("#location-icon");
        var mapSearchBoxID = $("#map-search-box");
        var mapSearchInputID = $("#map-search-input");
        var mapSearchMenuID = $("#map-search-menu");
        var mapSearchList = mapSearchMenuID.children("li");
        var mapSearchIcon = $("#search-icon");
                
        var visibilityIcons = null;
        
        /* Eclipse STATS IDs START */
        var sunRiseTimeID = $("#sunrise_time");
        var sunSetTimeID = $("#sunset_time");
        
        var statsBlock = $("#stats_block");
        var timeBlock = $("#time_block");
        var notVisibleID = $("#not_visible");
        
        var eclipsePicID = $("#eclipse_pic");
        var eclipseTypeID = $("#eclipse_type");
        var eclipseDateID = $("#eclipse_date");
        
        var coverageID = $("#coverage");
        var magnitudeID = $("#magnitude");
        var depthID = $("#depth");
        var depthTitleID = $("#depth_title");
        
        var c1TimeID = $("#c1_time");
        var c2TimeID = $("#c2_time");
        var midTimeID = $("#mid_time");
        var c3TimeID = $("#c3_time");
        var c4TimeID = $("#c4_time");
        
        var c1HorizID = $("#c1_horiz");
        var c2HorizID = $("#c2_horiz");
        var midHorizID = $("#mid_horiz");
        var c3HorizID = $("#c3_horiz");
        var c4HorizID = $("#c4_horiz");
        
        var sunRiseCountID = $("#sunrise_count");
        var c1CountID = $("#c1_count");
        var c2CountID = $("#c2_count");
        var midCountID = $("#mid_count");
        var c3CountID = $("#c3_count");
        var c4CountID = $("#c4_count");
        var sunSetCountID = $("#sunset_count");
        
        var entireDurationID = $("#entire_duration");
        var totalDurationID = $("#total_duration");
        
        /* BLOCK IDS */
        var sunRiseBlock = $("#sunrise");
        var partialBeginsBlock = $("#partial-begins");
        var totalBeginsID = $("#total_begins");
        var midEclipseBlock = $("#mid-eclipse");
        var totalEndsID = $("#total_ends");
        var paritalEndsBlcok = $("#partial-ends");
        var sunSetBlock = $("#sunset");
        /* BLOCK IDS END */
        
        var typeStartID = $("#type_div_start");
        var typeEndID = $("#type_div_ends");
        /* Eclipse STATS IDs END */
                
        var latID = $("#lat");
        var longID = $("#long");
        var altID = $("#alt");
        var timeID = $("#time");
        var zoneID = $("#zone");
        
        /* Map Poly Lines */
        var centralLine = map.addMultiPolyLine();
        var southernUmbraLine = map.addMultiPolyLine();
        var northernUmbraLine = map.addMultiPolyLine();
        var southernPenumbraLine = map.addMultiPolyLine(); 
        var northernPenumbraLine = map.addMultiPolyLine(); 
        var eastEclipseLine = map.addMultiPolyLine();
        var westEclipseLine = map.addMultiPolyLine();
        
        var westUmbraLine = null;
        var eastUmbraLine = null;
        
        var penumbraLineConnects = [];
        /* Map Poly Lines END */
        
        /* Map Shadow Polygons */
        var umbraShadow = null;
        var penumbraShadow = null;
        /* Map Shadow Polygons END */
        
        var headerHeight = material.getHeaderHeight();
        var footerHeight = material.getFooterHeight();
        var screenHeight = $(window).height();
        var mapHeight = screenHeight - headerHeight - footerHeight;
        
        updateCountDowns();
        latID.html(currentCoords.latitude.toFixed(2));
        longID.html(currentCoords.longitude.toFixed(2));
        altID.html((currentAltitude * METERS_TO_FEET).toFixed(2));
        
        window.setInterval(updateCountDowns, MASTER_TIMER_INTERVAL);
        
        var calculateWorker = new Worker("calculateWorker.js");
        var shadowAnimator = new ShadowAnimator;
        var lineWorkers = new LineWorkers(onEclipseLinesUpdate);
        var lineCount = 0;
        
        jMap.height(mapHeight);
        
        updateSimMetrics(mapHeight);
        
        calculateWorker.postMessage({'cmd': 'coords', 'coords': JSON.stringify(currentCoords)});
        
        var locationMarker = map.addMarker(currentCoords, LOCATION_MARKER_URL);
        
        setLocation(currentCoords);
        
        function radToDeg(angleRad)
        {
            if (isNaN(angleRad))
            {
                console.log("RAD NAN");
                return 0.0;
            }
            return (180.0 * angleRad / Math.PI);
        }

        function degToRad(angleDeg)
        {
            if (isNaN(angleDeg))
            {
                console.log("DEG NAN");
                return 0.0;
            }
            return (Math.PI * angleDeg / 180.0);
        }

        function sin(/* Number */ deg)
        {
            var ans = Math.sin(degToRad(deg));
            if (isNaN(ans))
            {
                console.log("SIN NAN");
                return 0.0;
            }
            return ans;
        }

        function cos(/* Number */ deg)
        {
            var ans = Math.cos(degToRad(deg));
            if (isNaN(ans))
            {
                console.log("COS NAN");
                return 0.0;
            }
            return ans;
        }
           
        function firstRun()
        {
            if(!window.localStorage.getItem(RUN_BEFORE))
            {
                window.localStorage.setItem(RUN_BEFORE, "true");
                
                var dialogBox = new DialogBox(  "Location Information Request",
                                                "This app requires the use of location information, please enable this feature when prompted.");
                                                
                dialogBox.hideCloseButton();
                dialogBox.setOKCallBack(function()
                {
                    setLocationMode(true);
                });
                
                material.hideSpinner();
                dialogBox.showModal();
            }
            else
            {
                setLocationMode(true);
            }
        }
        
        function checkZooms()
        {
            if(map.getZoom() >= map.getMaxZoom())
            {
                mapZoomInButton.prop("disabled", true);
            }
            else
            {
                mapZoomInButton.prop("disabled", false);
            }
            
            if(map.getZoom() <= map.getMinZoom())
            {
                mapZoomOutButton.prop("disabled", true);
            }
            else
            {
                mapZoomOutButton.prop("disabled", false);
            }
        }
        
        function onMapDisplay()
        {
            console.log("Page change to map.");
            headerHeight = material.getHeaderHeight();
            footerHeight = material.getFooterHeight();
            mapHeight = screenHeight - headerHeight - footerHeight;
            jMap.height(mapHeight);
            material.disableYScroll();
            map.updateSize();
            mapMenuButton.show();
            mapSearchBoxID.show();
            checkIfEclipseIsOccurring();
        }
        
        function isSmallScreen()
        {               
            var searchBoxWidth = mapSearchBoxID.width();
            var docWidth = $(document).width();
            var ratio = searchBoxWidth / docWidth;

            if(ratio > .6)
            {
                return true;
            }

            return false;
        }
        
        function updateSimMetrics(mapHeight)
        {
            var width = $(document).width();
            simulationTab.height(mapHeight);
            
            if(mapHeight < width)
            {
                width = mapHeight;
            }
            
            moon.width(width * .5);
            moon.height(width * .5);
            sun.width(width * .5);
            sun.height(width * .5);            
        }
        
        function checkLocalTimeZone()
        {
            localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        }
        
        function displaySimMenuItems()
        {
            firstContactItem.show();
            midEclipseItem.show();
            fourthContactItem.show();
        }
        
        function displayCentralSimMenuItems()
        {
            secondContactItem.show();
            thirdContactItem.show();
        }
        
        function hideSimMenuItems()
        {
            firstContactItem.hide();
            secondContactItem.hide();
            midEclipseItem.hide();
            thirdContactItem.hide();
            fourthContactItem.hide();
        }
                        
        function bindEvents()
        {
            console.log("Binding Eclipse UI events.");
            
            window.setInterval(checkLocalTimeZone, 30000);
            
            material.onPageChange(function (event)
            {
                console.log("Page change fired.");
                hideSimMenuItems();
                mapMenuButton.hide();
                mapSearchBoxID.hide();                
                
                material.enableYScroll();
                hideMoon();
                
                if (MAP_PAGE_IDX === event.currentPageIdx)
                {
                    console.log("Map page displayed.");
                    onMapDisplay();
                }
                else if (SIM_PAGE_IDX === event.currentPageIdx)
                {
                    console.log("Simulation page displayed.");
                    headerHeight = material.getHeaderHeight();
                    footerHeight = material.getFooterHeight();
                    mapHeight = screenHeight - headerHeight - footerHeight;
                    updateSimMetrics(mapHeight);
                    material.disableYScroll();
                    mapMenuButton.show();
                    
                    if(!shadowAnimator.isAnimating())
                    {
                        if(midTime)
                        {
                            displaySimMenuItems();
                            
                            if(c2Time)
                            {
                                displayCentralSimMenuItems();
                                switch (simulationSelection)
                                {
                                    case MID_SELECTION:
                                        goMidContactPoint();
                                        break;
                                    case C1_SELECTION:
                                        goC1ContactPoint();
                                        break;
                                    case C2_SELECTION:
                                        goC2ContactPoint();
                                        break;
                                    case C3_SELECTION:
                                        goC3ContactPoint();
                                        break;
                                    case C4_SELECTION:
                                        goC1ContactPoint();
                                    default:
                                        goMidConactPoint();
                                        break;
                                }
                            }
                            else
                            {
                               switch (simulationSelection)
                                {
                                    case MID_SELECTION:
                                        goMidContactPoint();
                                        break;
                                    case C1_SELECTION:
                                        goC1ContactPoint();
                                        break;
                                    case C4_SELECTION:
                                        goC1ContactPoint();
                                    default:
                                        goMidContactPoint();
                                        break;
                                } 
                            }
                        }
                        else
                        {
                            noSimEclipse();
                        }
                    }
                }
                else
                {
                    console.log("Circumstances page displayed.");
                    stopShadowAnimation();
                }
            });
            
            firstContactItem.click(function()
            {
                stopShadowAnimation();
                goC1ContactPoint();                                
            });
            secondContactItem.click(function()
            {
                stopShadowAnimation();
                goC2ContactPoint();  
            });
            midEclipseItem.click(function()
            {
                stopShadowAnimation();
                goMidContactPoint();                
            });
            thirdContactItem.click(function()
            {
                stopShadowAnimation();
                goC3ContactPoint();  
            });
            fourthContactItem.click(function()
            {
                stopShadowAnimation();
                goC4ContactPoint();
            });
            
            calculateWorker.onmessage = onCalculateMsg;
            
            positionWatch.setPositionCall(onPosition);
            positionWatch.setErrorCall(onPositionError);
            
            locationIcon.click(function()
            {
                if(positionWatch.isOn())
                {
                    setLocationMode(false);
                }
                else
                {
                    setLocationMode(true);
                }
            });
            
            jMap.longPress(onToggleClick);
            
            // Prevents long press / right click context menus.
            window.oncontextmenu = function(event) 
            {
                event.preventDefault();
                event.stopPropagation();
                return false;
            };
            
            realtimeShadowMenuItem.click(function(event)
            {
                mapMenuID.transitionEndOne(function(event)
                {
                    startRealTimeAnimation();
                });
            });
            
            material.onHeaderChange(function (event)
            {
                console.log("Header change.");
                headerHeight = material.getHeaderHeight();
                footerHeight = material.getFooterHeight();
                mapHeight = screenHeight - headerHeight - footerHeight;
                jMap.height(mapHeight);
                map.updateSize();
            });

            material.onWindowResize(function (event)
            {
                console.log("UI: Window height change.");
                
                headerHeight = material.getHeaderHeight();
                footerHeight = material.getFooterHeight();
                screenHeight = $(window).height();
                mapHeight = screenHeight - headerHeight - footerHeight;
                jMap.height(mapHeight);
                map.updateSize();
                updateSimMetrics(mapHeight);
                updateMoonPosition();
                if(mapSearchInputID.is(":focus"))
                {
                    if(isSmallScreen())
                    {
                        if(!eclipseTitle.hasClass("eclipse-hide-header-text"))
                        {
                            eclipseTitle.addClass("eclipse-hide-header-text");
                        }
                        if(!eclipseTitleDate.hasClass("eclipse-hide-header-text"))
                        {
                            eclipseTitleDate.addClass("eclipse-hide-header-text");
                        }
                        
                        if(!material.isDrawerButtonSpun())
                        {
                            material.spinBackDrawerButton(); 
                        }
                        mapSearchIcon.parent("label").hide();
                    }
                    else
                    {
                        eclipseTitle.removeClass("eclipse-hide-header-text");
                        eclipseTitleDate.removeClass("eclipse-hide-header-text");
                        mapSearchIcon.parent("label").show();
                        material.unSpinDrawerButton();
                    }
                }
                else
                {
                    eclipseTitle.removeClass("eclipse-hide-header-text");
                    eclipseTitleDate.removeClass("eclipse-hide-header-text");
                    material.unSpinDrawerButton();
                    mapSearchIcon.parent("label").show();
                }
            });
            
            material.onDrawerOpen(function(event)
            {
                console.log("Drawer opened.");
                scrollToMiddle($(eclipseList.children("li")[selectedEclipse]));
            });
            
            material.onDrawerClosed(function(event)
            {
                console.log("Drawer closed.");
            });
            
            nextButton.click(function(event)
            {
                findNextEclipse();
            });
            
            timeID.click(function(event)
            {
               if(dateOffset !== 0)
               {
                   dateOffset = 0;
                   timeID.removeClass("eclipse-time-travel-font");
                   showToast("Returning to present time!");
                   stopShadowAnimation();
               }
               checkIfEclipseIsOccurring();
            });
            
            partialBeginsBlock.longPress(function(event)
            {
                if(c1Time)
                {
                    dateOffset = c1Time.getTime() - (new Date().getTime());
                    timeID.addClass("eclipse-time-travel-font");
                    material.changePage(1);
                    showToast("Time traveling to partial eclipse begins!");                    
                }
            });
            
            totalBeginsID.longPress(function(event)
            {
                if(c2Time)
                {                 
                    dateOffset = c2Time.getTime() - (new Date().getTime());
                    timeID.addClass("eclipse-time-travel-font");
                    material.changePage(1);
                    showToast("Time traveling to " + currentEclipseRef.type + " eclipse begins!");
                }
            });
            
            midEclipseBlock.longPress(function(event)
            {
                if(midTime)
                {
                    dateOffset = midTime.getTime() - (new Date().getTime());
                    timeID.addClass("eclipse-time-travel-font");
                    material.changePage(1);
                    showToast("Time traveling to mid eclipse!");
                }                
            });
            
            totalEndsID.longPress(function(event)
            {
                if(c3Time)
                {
                    dateOffset = c3Time.getTime() - (new Date().getTime());
                    timeID.addClass("eclipse-time-travel-font");
                    material.changePage(1);
                    showToast("Time traveling to " + currentEclipseRef.type + " eclipse ends!");
                }
            });
            
            paritalEndsBlcok.longPress(function(event)
            {
               if(c4Time)
               {
                    dateOffset = c4Time.getTime() - (new Date().getTime());
                    timeID.addClass("eclipse-time-travel-font");
                    material.changePage(1);
                    showToast("Time traveling to end of eclipse!");
               }
            });
            
            visibleButton.click(function(event)
            {
                findNextVisibleEclipse();
            });
            
            mapLocationButton.click(function(event)
            {
                toggleMapPositionLock();
            });
            
            mapZoomInButton.click(function(ev)
            {
                map.zoomIn();
            });
            
            mapZoomOutButton.click(function(ev)
            {
                map.zoomOut();
            });            
            
            map.onDragStart(function(ev)
            {
                tempIgnoreLock = true;
                console.log("Map drag started.");                
            });
            
            map.onDragEnd(function(ev)
            {
                if(ev.distance > IGNORE_DRAG)
                {
                    mapPositionLockOff();
                }
                else
                {
                    if(mapPositionLock)
                    {
                        map.setCenter(currentCoords);
                    }
                }
                tempIgnoreLock = false;
                
                console.log("Map drag ended.");
            });
            
            jMap.keydown(function(ev)
            {
                if(ev.keyCode <= 40 && ev.keyCode >= 37)
                {
                    mapPositionLockOff();
                    console.log("Map arrow key event.");  
                }
            });
            
            map.onZoomEnd(function(ev)
            {
                console.log("ZOOM LEVEL: " + map.getZoom());
                
                checkZooms();
                if(mapPositionLock)
                {
                    map.setCenter(currentCoords);
                }
            });
            
            map.onRedrawCall(function(ev)
            {
                console.log("Redraw call!");
                
                centralLine.reDraw();
                southernUmbraLine.reDraw();
                northernUmbraLine.reDraw();
                southernPenumbraLine.reDraw();
                northernPenumbraLine.reDraw();
                eastEclipseLine.reDraw();                                
                westEclipseLine.reDraw();
                if(eastUmbraLine)
                {
                    eastUmbraLine.reDraw();
                }
                if(westUmbraLine)
                {
                    westUmbraLine.reDraw();
                }
                               
                for(var i = 0; i < penumbraLineConnects.length; i++)
                {
                    penumbraLineConnects[i].reDraw();
                }
            });
            
            material.onMDLComplete(function()
            {
                material.toggleHeaderFooter(true);
            });
            
            mapSearchInputID.focus(function(event)
            {
                if(isSmallScreen())
                {
                    eclipseTitle.addClass("eclipse-hide-header-text");
                    eclipseTitleDate.addClass("eclipse-hide-header-text");
                    material.spinBackDrawerButton(); 
                    mapSearchIcon.parent("label").hide();
                }
                
                mapSearchData = null;
                
                mapSearchMenuID.addClass("eclipse-map-search-list-show");
                mapSearchInputID.val("");
                resetMapSearchMenu();
            });
            
            mapSearchInputID.focusout(function(event)
            {
                mapSearchInputID.val("");
                mapSearchBoxID.removeClass("is-dirty");
                mapSearchMenuID.removeClass("eclipse-map-search-list-show");
                eclipseTitle.removeClass("eclipse-hide-header-text");
                eclipseTitleDate.removeClass("eclipse-hide-header-text");
                resetMapSearchMenu();
                
                material.unSpinDrawerButton();
                mapSearchIcon.parent("label").show();
            });
            
            mapSearchList.click(function(event)
            {
                console.log("Map search click fired.");
                if(mapSearchData)
                {
                    var idx = $(this).index();
                    if(idx < mapSearchData.length)
                    {
                        console.log("Item: " + idx);
                        setLocationMode(false);
                        setLocation(new Position(parseFloat(mapSearchData[idx].lat), parseFloat(mapSearchData[idx].lon)));
                        mapSearchData = null;
                    }
                }
            });
           
            mapSearchInputID.on("input", function(ev)
            {
                var searchVal =  encodeURIComponent(mapSearchInputID.val());
               console.log("Search box value: " + searchVal);
               
               var searchString = "https://nominatim.openstreetmap.org/search?q=QUERY&format=json&limit=3";
               
               searchString = searchString.replace("QUERY", searchVal);
               
               var jqxhr = $.getJSON(searchString, function() 
                {
                    console.log("Initial JSON success.");
                }).done(function (data) 
                {
                    mapSearchData = data;
                    mapSearchList.eq(0).removeClass("eclipse-disabled-text");
                    for(var i = 0; i < data.length; i++)
                    {
                        mapSearchList.eq(i).children("span").html(data[i].display_name);
                    }
                    for(var x = mapSearchList.length; x > data.length && x > 0; x--)
                    {
                        mapSearchList.eq(x - 1).children("span").html("");
                    }
                                        
                    console.log("Second JSON success.");
                }).fail(function () 
                {
                    console.log("JSON error.");
                }).always(function () 
                {
                    console.log("JSON complete.");
                });
            });
        }
        
        function resetMapSearchMenu()
        {
            mapSearchList.eq(0).addClass("eclipse-disabled-text");
            mapSearchList.eq(0).children("span").html("Searching locations...");
            for(var i = 1; i < mapSearchList.length; i++)
            {
                mapSearchList.eq(i).children("span").html("");
            }
        }
        
        function toggleMapPositionLock()
        {
            if(mapPositionLock)
            {
                mapPositionLockOff();
            }
            else
            {
                mapPositionLockOn();
            }
        }
        
        function mapPositionLockOff()
        {
            mapPositionLock = false;
            mapLocationButton.children("i").html("location_searching");
        }
        
        function mapPositionLockOn()
        {
            mapLocationButton.children("i").html("my_location");
            mapPositionLock = true;
            map.setCenter(currentCoords);
        }
        
        function bindEclipseListEvent()
        {
            var eclipseListChildren = eclipseList.children("li");
            
            eclipseListChildren.click(function(event)
            {
                updateSelectedEclipse(parseInt($(this).attr("eclipse-index"), 10));                
                material.toggleDrawer();
                
                console.log("Selected eclipse: " + selectedEclipse);
            });
        }
        
        function findNextVisibleEclipse()
        {
            if(nextVisibleEclipse > -1)
            {
                updateSelectedEclipse(nextVisibleEclipse);
            }
        }
        
        function updateSelectedEclipse(newSelection)
        {
            realtimeShadowMenuItem.hide();
            animateShadowMenuItem.clickOff();
            animateShadowMenuItem.attr("disabled", true);
                       
            if(selectedEclipse > -1)
            {
                $(eclipseList.children("li")[selectedEclipse]).removeClass("eclipse-selected");
                currentEclipseRef.destroy();
            }
            selectedEclipse = newSelection;
            currentEclipseRef = eclipseCatalog.getEclipse(selectedEclipse);
            stopShadowAnimation();
            shadowAnimator.reset();            
            lineCount = 0;
            removeOldLines();
            var stringEclipse = JSON.stringify(currentEclipseRef);
            calculateWorker.postMessage({'cmd': 'eclipse', 'eclipse': stringEclipse});
            console.time("DrawLines");
            lineWorkers.updateLines(stringEclipse);
                       
            setEclipseTitle(currentEclipseRef);
            var nextSelectedEclipse = $(eclipseList.children("li")[selectedEclipse]);
            
            nextSelectedEclipse.addClass("eclipse-selected");
            
            scrollToMiddle(nextSelectedEclipse);            
        }
        
        function findNextEclipse()
        {  
            updateSelectedEclipse(eclipseCatalog.getNextEclipseIdx());
            console.log("Found next eclipse: " + selectedEclipse);
                 
           // TODO:
            /***
            getPosition();
            coordInterval = setInterval(backGroundUpdate, UPDATE_INTERVAL);
            buildEclipseList();
            ***/
           
            /*** TODO: Highlight selected eclipse.
            if (selected_eclipse < 0)
            {
                selected_eclipse = next_eclipse;
            }

            var eclipse_list_list_items = eclipse_list.children("li");
            var next_eclipse_item = eclipse_list_list_items.eq(next_eclipse);
            var selected_eclipse_item = eclipse_list_list_items.eq(selected_eclipse);

            // next_eclipse_item.children("a").append("<span class='ui-li-count'>Next Eclipse</span>");
            next_eclipse_item.append("<span class='ui-li-count'>Next Eclipse</span>");

            eclipse_list.listview("refresh");
            // selected_eclipse_item.children("a").addClass('ui-btn-b');	// Changes background color of "selected" eclipse.
            selected_eclipse_item.removeClass('ui-body-inherit');
            selected_eclipse_item.addClass('ui-body-b');
            selected_eclipse_item.children("p").css("color", "white");
            ***/

            // TODO: Implement eclipse list click handlers
            /****
            eclipse_list_list_items.click(function (event)
            {
                onEclipseClicked(event, this);
            });
            ****/

            // TODO: Call draw eclipse map function.
            // drawEclipseMap();
        }
        
        function loadEclipseData()
        {
            console.log("Spawning eclipse loader thread.");
            material.showSpinner();
            if(eclipseLoadWorker === null)
            {
                eclipseLoadWorker = new Worker("EclipseLoader.js");
                eclipseLoadWorker.onmessage = onEclipseLoadMsg;
            }
        }
        
        function onCalculateMsg(msg)
        {
            var data = msg.data;
            
            switch (data.cmd)
            {
                case 'eclipse_stats_update':
                    onCalculateUpdate(data);
                    break;
                case 'visible_index_update':
                    onVisibleIndexUpdate(data);
                    break;
                default:
                    console.log("Unknow calculate message command.");
                    break;
            } 
        }
        
        function onEclipseLinesError(data)
        {
            removeOldLines();
            
            var errorDiag = new DialogBox(  "Pardon Our Error",
                                            "Unfortunately the eclipse circumstance lines could not be displayed for this eclipse. " +
                                            "This usually occurs with a partial eclipse that only occurs near the poles. " +
                                            "This is a known error and limatation. It is currently being investigated." +
                                            "Circumstance data, timings, and simulations should still work.", 
                                            "OK");
            errorDiag.hideCloseButton();
            
            errorDiag.showModal();
                   
        }
        
        function onEclipseLinesUpdate(data)
        {
            switch (data.type)
            {
                case 'central_line':
                    centralLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setCentralLine(data.line);
                    currentEclipseRef.setCentralLineTimes(data.times);
                    lineCount++;
                    break;
                case 'south_umbra_line':
                    southernUmbraLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setSouthUmbraLine(data.line);
                    currentEclipseRef.setSouthUmbraTimes(data.times);
                    lineCount++;                    
                    break;
                case 'north_umbra_line':
                    northernUmbraLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setNorthUmbraLine(data.line);
                    currentEclipseRef.setNorthUmbraTimes(data.times);
                    lineCount++;
                    break;
                case 'south_penumbra_line':
                    southernPenumbraLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setSouthPenumbraLine(data.line);
                    lineCount++;
                    break;
                case 'north_penumbra_line':
                    northernPenumbraLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setNorthPenumbraLine(data.line);
                    lineCount++;
                    break;
                case 'east_penumbra_line':                    
                    eastEclipseLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setEastLimitLine(data.line);
                    currentEclipseRef.setEastLineTimes(data.times);
                    lineCount++;
                    break;
                case 'west_penumbra_line':
                    westEclipseLine = map.addMultiPolyLine(data.line);
                    currentEclipseRef.setWestLimitLine(data.line);
                    currentEclipseRef.setWestLineTimes(data.times);
                    lineCount++;
                    break;
                default:
                    console.log("Unknown or invalid line type returned from line workers.");
                    break;                    
            }
            
            console.log(data.type + " line drawn."); 
            
            if(lineCount === LINE_COUNT)
            {
                connectLines();
                shadowAnimator.setEclipse(currentEclipseRef);
                console.timeEnd("DrawLines");
                animateShadowMenuItem.click(function(ev)
                {
                    mapMenuID.transitionEndOne(function(ev)
                    {
                        if (shadowAnimator.isAnimating())
                        {
                            stopShadowAnimation();
                        } 
                        else
                        {
                            startShadowAnimation();
                        }
                    });
                });
                
                animateShadowMenuItem.removeAttr("disabled");
            }                       
        }
        
        function connectLines()
        {
            var northUmbraLine = currentEclipseRef.getNorthUmbraLine();
            var southUmbraLine =  currentEclipseRef.getSouthUmbraLine();
            var northPenumbraLine = currentEclipseRef.getNorthPenumbraLine();
            var southPenumbraLine = currentEclipseRef.getSouthPenumbraLine();
            var eastLimitLine = currentEclipseRef.getEastLimitLine();
            var westLimitLine = currentEclipseRef.getWestLimitLine();
            var greatCircle = null;
            
            if(northUmbraLine && southUmbraLine)
            {
                westUmbraLine = map.addGreatCircle(northUmbraLine[0], southUmbraLine[0]);
                eastUmbraLine = map.addGreatCircle(northUmbraLine[northUmbraLine.length - 1], southUmbraLine[southUmbraLine.length - 1]);
            }
            
            if(southPenumbraLine && westLimitLine)
            {
                greatCircle = map.addGreatCircle(westLimitLine[0], southPenumbraLine[0]);
                
                if(greatCircle)
                {
                    penumbraLineConnects.push(greatCircle);
                }
            }
            
            if(southPenumbraLine && eastLimitLine)
            {
                greatCircle = map.addGreatCircle(southPenumbraLine[southPenumbraLine.length - 1], eastLimitLine[0]);
                
                if(greatCircle)
                {
                    penumbraLineConnects.push(greatCircle);
                }
            }
            
            if(eastLimitLine && northPenumbraLine)
            {
                greatCircle = map.addGreatCircle(eastLimitLine[eastLimitLine.length - 1], northPenumbraLine[northPenumbraLine.length - 1]);

                if(greatCircle)
                {
                    penumbraLineConnects.push(greatCircle);
                }
            }
            
            if(northPenumbraLine && westLimitLine)
            {
                greatCircle = map.addGreatCircle(northPenumbraLine[0], westLimitLine[westLimitLine.length - 1]);

                if(greatCircle)
                {
                    penumbraLineConnects.push(greatCircle);
                }
            }
            
            if(!northPenumbraLine && (westLimitLine && eastLimitLine))
            {
                greatCircle = map.addGreatCircle(westLimitLine[westLimitLine.length - 1], eastLimitLine[eastLimitLine.length - 1]);

                if(greatCircle)
                {
                    penumbraLineConnects.push(greatCircle);
                }
            }
            
            if(!southPenumbraLine && (westLimitLine && eastLimitLine))
            {
                greatCircle = map.addGreatCircle(westLimitLine[0], eastLimitLine[0]);

                if(greatCircle)
                {
                    penumbraLineConnects.push(greatCircle);
                }
            }
        }
        
        /*
         * Removes all eclipse lines from map, if they exist.
         * @returns {undefined}
         */
        function removeOldLines()
        {
            centralLine = map.removeFeature(centralLine);             
            southernUmbraLine = map.removeFeature(southernUmbraLine);
            northernUmbraLine = map.removeFeature(northernUmbraLine);
            southernPenumbraLine = map.removeFeature(southernPenumbraLine);
            northernPenumbraLine = map.removeFeature(northernPenumbraLine);
            eastEclipseLine = map.removeFeature(eastEclipseLine);
            westEclipseLine = map.removeFeature(westEclipseLine);
            westUmbraLine = map.removeFeature(westUmbraLine);
            eastUmbraLine = map.removeFeature(eastUmbraLine);
            
            for(var i = 0; i < penumbraLineConnects.length; i++)
            {
                map.removeFeature(penumbraLineConnects[i]);
            }
            
            penumbraLineConnects.length = 0;
            
            console.log("Eclipse lines removed.");
        }
        
        function onToggleClick()
        {
            console.log("Toggle click fired.");
            
            longCickFired = true;
            
            window.setTimeout(function()
            {
                longCickFired = false;
            }, 1200);
            
            if(material.toggleHeaderFooter())
            {
                mapSection.removeClass("eclipse-section-expand");
                mapButtons.addClass("eclipse-map-button-placement-transition");
                zoomButtons.addClass("eclipse-zoom-button-placement-transition");
            }
            else
            {
                mapButtons.removeClass("eclipse-map-button-placement-transition");
                zoomButtons.removeClass("eclipse-zoom-button-placement-transition");
                mapSection.addClass("eclipse-section-expand");
            }
        }
        
        function onVisibleIndexUpdate(data)
        {
            visibleArray = JSON.parse(data.visible_array);
            nextVisibleEclipse = parseInt(data.next_visible, 10);
            
            if(visibilityIcons)
            {
                updateVisibleList();
            }
        }
        
        function onCalculateUpdate(data)
        {
            var eclipseStats = new ObserverCircumstances(JSON.parse(data.eclipse_stats));
            
            var current_date = new Date();
            current_date.setTime(current_date.getTime() + dateOffset);

            if (eclipseStats.isVisible)		// TODO: Fix? CPU time costly to traverse the DOM everytime we update this.
            {
                var date_options = {year: "numeric", month: "long", day: "numeric"};
                                
                c1Time = currentEclipseRef.toDate(eclipseStats.circDates.getC1Date());
                midTime = currentEclipseRef.toDate(eclipseStats.circDates.getMidDate());
                c4Time = currentEclipseRef.toDate(eclipseStats.circDates.getC4Date());
                
                var zone_options = {};
                
                if(selectedTimeZone)
                {
                    zone_options = { timeZone: selectedTimeZone, timeZoneName: 'short' };
                }
                
                var midSolarElevation = parseFloat(data.solar_elevation);
                
                var sunrise_time_string = "";
                var sunset_time_string = "";
               
                if (JSON.parse(data.sunrise) === null)
                {
                    sunRiseTime = null;
                    
                    if (midSolarElevation >= 0.0)
                    {
                        sunrise_time_string = "Sun is Up";
                    } 
                    else
                    {
                        sunrise_time_string = "Sun is Down";    // This situation should not be possible.
                    }
                } 
                else
                {
                    sunRiseTime = new Date(JSON.parse(data.sunrise));
                    sunrise_time_string = sunRiseTime.toLocaleTimeString(TIME_LOCALE, zone_options);
                    
                }
                if (JSON.parse(data.sunset) === null)
                {
                    sunSetTime = null;
                    
                    if (midSolarElevation >= 0.0)
                    {
                        sunset_time_string = "Sun is Up";
                    } 
                    else
                    {
                        sunset_time_string = "Sun is Down";    // This situation should not be possible.
                    }
                } 
                else
                {
                    sunSetTime = new Date(JSON.parse(data.sunset));
                    sunset_time_string = sunSetTime.toLocaleTimeString(TIME_LOCALE, zone_options);
                }
                
                sunRiseTimeID.html(sunrise_time_string);
                sunSetTimeID.html(sunset_time_string);
                
                statsBlock.show(0);
                timeBlock.show(0);
                notVisibleID.hide(0);
                
                eclipsePicID.css({ "background": "url('" + IMGS_FOLDER + eclipseStats.eclipseType.toLowerCase() + ".png')",
                                   "background-size": "contain"});
                eclipseTypeID.html(eclipseStats.eclipseType + " Eclipse Occurs");
                eclipseDateID.html(midTime.toLocaleDateString(TIME_LOCALE, date_options));
                coverageID.html(eclipseStats.coverage.toFixed(1) + "%");
                magnitudeID.html(eclipseStats.magnitude.toFixed(1) + "%");

                c1TimeID.html(c1Time.toLocaleTimeString(TIME_LOCALE, zone_options));
                
                midTimeID.html(midTime.toLocaleTimeString(TIME_LOCALE, zone_options));
                
                c4TimeID.html(c4Time.toLocaleTimeString(TIME_LOCALE, zone_options));
                
                var eclipseDuration = checkEntireDuration(eclipseStats, sunRiseTime, sunSetTime);
                entireDurationID.html(eclipseDuration.toTimeString());

                if (eclipseStats.firstContactBelowHorizon)
                {
                    c1HorizID.show(0);
                } 
                else
                {
                    c1HorizID.hide(0);
                }

                if (eclipseStats.midEclipseBelowHorizon)
                {
                    midHorizID.show(0);
                } 
                else
                {
                    midHorizID.hide(0);
                }

                if (eclipseStats.fourthContactBelowHorizon)
                {
                    c4HorizID.show(0);
                } 
                else
                {
                    c4HorizID.hide(0);
                }

                if (eclipseStats.eclipseType === "Annular" || eclipseStats.eclipseType === "Total")
                {
                    c2Time = currentEclipseRef.toDate(eclipseStats.circDates.getC2Date());
                    c3Time = currentEclipseRef.toDate(eclipseStats.circDates.getC3Date());
                    
                    var depth_string = eclipseStats.depth.toFixed(1) + "%";
                    if (eclipseStats.northOfCenter)
                    {
                        depth_string += " N";
                    } 
                    else
                    {
                        depth_string += " S";
                    }

                    totalBeginsID.show(0);
                    totalEndsID.show(0);
                    depthID.show(0);
                    depthTitleID.show(0);
                    depthID.html(depth_string);
                    typeStartID.html(eclipseStats.eclipseType + " Phase Begins");
                    typeEndID.html(eclipseStats.eclipseType + " Phase Ends");

                    c2TimeID.html(c2Time.toLocaleTimeString(TIME_LOCALE, zone_options));
                    
                    c3TimeID.html(c3Time.toLocaleTimeString(TIME_LOCALE, zone_options));
                    
                    var centralDuration = checkCentralDuration(eclipseStats, sunRiseTime, sunSetTime);
                    totalDurationID.html(centralDuration.toTimeString());

                    if (eclipseStats.secondContactBelowHorizon)
                    {
                        c2HorizID.show(0);
                    } 
                    else
                    {
                        c2HorizID.hide(0);
                    }

                    if (eclipseStats.thirdContactBelowHorizon)
                    {
                        c3HorizID.show(0);
                    } 
                    else
                    {
                        c3HorizID.hide(0);
                    }
                    
                    displayCentralSimMenuItems();
                } 
                else
                {
                    c2Time = null;
                    c3Time = null;
                    c2CountID.html("");
                    c3CountID.html("");
                    depthID.hide(0);
                    depthTitleID.hide(0);
                    totalBeginsID.hide(0);
                    totalEndsID.hide(0);
                }
                
                updateCountDowns();
                
                switch(simulationSelection)
                {
                    case MID_SELECTION:
                        goMidContactPoint();
                        break;
                    case C1_SELECTION:
                        goC1ContactPoint();
                        break;
                    case C4_SELECTION:
                        goC1ContactPoint();
                    default:
                        goMidContactPoint();
                        break;
                }
            } 
            else
            {
                hideSimMenuItems();
                noSimEclipse();
                c1Time = null;
                midTime = null;
                c4Time = null;
                sunRiseCountID.html("");
                c1CountID.html("");
                midCountID.html("");
                c4CountID.html("");
                sunSetCountID.html("");
                resetEclipseListStats();
            }
        }
        
        /*
         * From inputed oberserver circumstances
         * return modified TimeSpan in case sun rises 
         * or sets before eclipse ends or begins.
         * @param {ObserverCircumstances} eStats
         * @param {Date} sunRise
         * @param {Date} sunSet
         * @returns {TimeSpan}
         */
        function checkEntireDuration(eStats, sunRise, sunSet)
        {
            if(eStats.firstContactBelowHorizon && eStats.fourthContactBelowHorizon)
            {
                return new TimeSpan(sunRise, sunSet);
            }
            else if(eStats.firstContactBelowHorizon && !eStats.fourthContactBelowHorizon)
            {
                return new TimeSpan(sunRise, currentEclipseRef.toDate(eStats.circDates.getC4Date()));
            }
            else if(!eStats.firstContactBelowHorizon && eStats.fourthContactBelowHorizon)
            {
                return new TimeSpan(currentEclipseRef.toDate(eStats.circDates.getC1Date()), sunSet);
            }
            else
            {
                return eStats.c1c4TimeSpan;
            }
            
           return new TimeSpan(); 
        }
        
        /*
         * From inputed oberserver circumstances
         * return modified TimeSpan incase sun rises 
         * or sets before total/annular eclipse ends or begins.
         * @param {ObserverCircumstances} eStats
         * @param {Date} sunRise
         * @param {Date} sunSet
         * @returns {TimeSpan}
         */
        function checkCentralDuration(eStats, sunRise, sunSet)
        {
            if(eStats.secondContactBelowHorizon && eStats.thirdContactBelowHorizon)
            {
                return new TimeSpan();
            }
            else if(eStats.secondContactBelowHorizon && !eStats.thirdContactBelowHorizon)
            {
                return new TimeSpan(sunRise, eStats.circDates.getC3Date());
            }
            else if(!eStats.secondContactBelowHorizon && eStats.thirdContactBelowHorizon)
            {
                return new TimeSpan(eStats.circDates.getC2Date(), sunSet);
            }
            else
            {
                return eStats.c2c3TimeSpan;
            }
            
           return new TimeSpan(); 
        }
        
        function checkIfEclipseIsOccurring(bDontAnimate)
        {
            if(currentEclipseRef)
            {
                var current_date = new Date();
                current_date.setTime(current_date.getTime() + dateOffset);
                if (currentEclipseRef.isEclipseOccurring(current_date))
                {
                    realtimeShadowMenuItem.show();
                    if(!bDontAnimate  && !shadowAnimator.isAnimating())
                    {
                        startRealTimeAnimation();
                    }
                    return true;
                } 
                else
                {
                    if(!bDontAnimate && !shadowAnimator.isAnimating())
                    {
                        stopShadowAnimation();
                    }
                    realtimeShadowMenuItem.hide();
                    realTimeInfoID.removeClass("eclipse-realtime-shadow-trans");
                    goMidContactPoint();
                }
            }
            
            return false;
        }
        
        function removeContactPoint()
        {
            contactPointID.removeClass("eclipse-sim-info-trans");
        }
        
        function noSimEclipse()
        {
           if(!contactPointID.hasClass("eclipse-sim-info-trans"))
            {
                contactPointID.addClass("eclipse-sim-info-trans");
            }
           contactPointID.children("span").html("Eclipse Not Visible"); 
           hideMoon();       
        }
        
        function goC1ContactPoint()
        {
            simulationSelection = C1_SELECTION;
            if(c1Time)
            {
                shadowAnimator.getMoonPosition(c1Time, currentCoords, onMoonPosition);
                if(!contactPointID.hasClass("eclipse-sim-info-trans"))
                {
                    contactPointID.addClass("eclipse-sim-info-trans");
                }
                contactPointID.children("span").html("First Contact");
            }
        }
        
        function goC2ContactPoint()
        {
            simulationSelection = C2_SELECTION;
            if(c2Time)
            {
                shadowAnimator.getMoonPosition(c2Time, currentCoords, onMoonPosition);
                if(!contactPointID.hasClass("eclipse-sim-info-trans"))
                {
                    contactPointID.addClass("eclipse-sim-info-trans");
                }
                contactPointID.children("span").html("Second Contact");
            }
        }
        
        function goMidContactPoint()
        {
           console.log("Mid contact point simulation.");
            simulationSelection = MID_SELECTION;
            
            if(midTime)
            {
                shadowAnimator.getMoonPosition(midTime, currentCoords, onMoonPosition);
            
                if(!contactPointID.hasClass("eclipse-sim-info-trans"))
                {
                    contactPointID.addClass("eclipse-sim-info-trans");
                }
                
                contactPointID.children("span").html("Mid Eclipse");
            }
        }
        
        function goC3ContactPoint()
        {
            simulationSelection = C3_SELECTION;
            if(c1Time)
            {
                shadowAnimator.getMoonPosition(c3Time, currentCoords, onMoonPosition);
                if(!contactPointID.hasClass("eclipse-sim-info-trans"))
                {
                    contactPointID.addClass("eclipse-sim-info-trans");
                }
                contactPointID.children("span").html("Third Contact");
            }
        }
        
        function goC4ContactPoint()
        {
            simulationSelection = C4_SELECTION;
            if(c4Time)
            {
                shadowAnimator.getMoonPosition(c4Time, currentCoords, onMoonPosition);
                if(!contactPointID.hasClass("eclipse-sim-info-trans"))
                {
                    contactPointID.addClass("eclipse-sim-info-trans");
                }
                contactPointID.children("span").html("Fourth Contact");
            }
        }
        
        function updateCountDowns()
        {
            var current_date = new Date();
            current_date.setTime(current_date.getTime() + dateOffset);
            var zone_options = { timeZone: localTimeZone, timeZoneName: 'short' };

            if(selectedTimeZone)
            {
                zone_options = { timeZone: selectedTimeZone, timeZoneName: 'short' };
            }
            
            var timeString = current_date.toLocaleTimeString(TIME_LOCALE, zone_options);
            var zoneString = timeString.slice(-3);
            timeString = timeString.slice(0, -4);
            timeID.html(timeString);
            zoneID.html(zoneString);
            
            var rise_count_str = "--:--:--";
            var set_count_str = "--:--:--";
            
            if(sunRiseTime)
            {
                rise_count_str = new TimeSpan(sunRiseTime, current_date).toTimeString();
            }
            if(sunSetTime)
            {
                set_count_str = new TimeSpan(sunSetTime, current_date).toTimeString();
            }
            
            sunRiseCountID.html(rise_count_str);
            sunSetCountID.html(set_count_str);
            
            if(c1Time)
            {
                var c1CountDown = new TimeSpan(c1Time, current_date);
                c1CountID.html(c1CountDown.toTimeString());
            }
            
            if(midTime)
            {
                var midCountDown = new TimeSpan(midTime, current_date);
                midCountID.html(midCountDown.toTimeString());
            }
                        
            if(c4Time)
            {
                var c4CountDown = new TimeSpan(c4Time, current_date);
                c4CountID.html(c4CountDown.toTimeString());
            }
            
            if(c2Time)
            {
                var c2CountDown = new TimeSpan(c2Time, current_date);
                c2CountID.html(c2CountDown.toTimeString());    
            }
                        
            if(c3Time)
            {
               var c3CountDown = new TimeSpan(c3Time, current_date); 
               c3CountID.html(c3CountDown.toTimeString());
            }           
        }
        
        // Resets the Eclipse Countdown Stats View
        function resetEclipseListStats()
        {
            statsBlock.hide(0);
            timeBlock.hide(0);
            eclipseTypeID.html("No Eclipse Occurs");
            notVisibleID.show(0);
            coverageID.html("0.0%");
            magnitudeID.html("0.0%");
            depthID.hide(0);
            depthTitleID.hide(0);
            eclipseDateID.html("");
            eclipsePicID.css({ "background": "url('images/no-eclipse.png')",
                                "background-size": "contain"});
        }
        
        function onEclipseLoadMsg(msg)
        {
            var data = msg.data;

            switch (data.cmd)
            {
                case 'eclipse_load_complete':
                    onEclipseLoadComplete(data);
                    break;
                case 'eclipse_html_complete':
                    onEclipseHTMLComplete(data);
                    break;
                case 'eclipse_load_error':
                    onEclipseLoadError(data);
                    break;
                default:
                    break;
            }  
        }
        
        function onEclipseHTMLComplete(data)
        {
            eclipseList.html(data.eclipse_data);
            
            if(eclipseLoadWorker !== null)
            {
                eclipseLoadWorker.terminate();
                eclipseLoadWorker = null;
                console.log("Terminated eclipse loader thread.");
            }
            
            material.hideSpinner();
            jMap.show(); // Keep map from being displayed until loading is complete, otherwise it bleeds through during startup.
            simulationTab.children(".simulation-content").show();
            
            visibilityIcons = $(".visible-class");
            console.log("Icon count: " + visibilityIcons.length);
            
            bindEclipseListEvent();
            if(visibleArray)
            {
                updateVisibleList();
            }
            findNextEclipse();
        }
        
        function updateVisibleList()
        {
            visibilityIcons.hide();
            for(var i = 0; i < visibleArray.length; i++)
            {
                $(visibilityIcons[visibleArray[i]]).show();
            }
        }
        
        function onEclipseLoadComplete(data)
        {
            eclipseCatalog.copyEclipsesIn(JSON.parse(data.eclipse_data));
            
            calculateWorker.postMessage({'cmd': 'update_catalog', 'catalog': eclipseCatalog.eclipseToJSON()});
            
            console.log("Eclipse UI load complete: " + eclipseCatalog.getEclipseCount() + " eclipses loaded.");
        }
        
        function onEclipseLoadError(data)
        {
            if(eclipseLoadWorker !== null)
            {
                eclipseLoadWorker.terminate();
                eclipseLoadWorker = null;
            }

            console.log("Eclipse loader error: " + data.status);
            material.hideSpinner();
            
            // TODO: Pop dialog box showing error to user.
        }
        
        function onPosition(coords)
        {
            setLocation(coords);
        }
        
        function setLocation(coords)
        {
            currentCoords = coords;
            if(currentCoords.altitude)
            {
                currentAltitude = currentCoords.altitude;
            }
            
            var localCoords = {
                "latitude": currentCoords.latitude,
                "longitude": currentCoords.longitude,
                "altitude": currentAltitude                
            };
            
            latID.html(currentCoords.latitude.toFixed(2));
            longID.html(currentCoords.longitude.toFixed(2));
            altID.html((currentAltitude * METERS_TO_FEET).toFixed(2));
            
            shadowAnimator.setCoords(localCoords);
            
            calculateWorker.postMessage({'cmd': 'coords', 'coords': JSON.stringify(localCoords)});
                        
            locationMarker.setLocation(currentCoords);
            
            if(mapPositionLock && !tempIgnoreLock)
            {
                map.setCenter(currentCoords);
            }
            
            if(!positionWatch.isOn())
            {
                try
                {
                    selectedTimeZone = timeZone.lookup(currentCoords.latitude, currentCoords.longitude);
                    console.log("New timezone: " + selectedTimeZone);
                }
                catch(error)
                {
                    console.log("Time zone DB not ready... trying again in 1 second.");
                    window.setTimeout(function()
                    {
                        selectedTimeZone = timeZone.lookup(currentCoords.latitude, currentCoords.longitude);
                        console.log("New timezone: " + selectedTimeZone);
                    }, 1000);
                }
            }
            else
            {
                checkLocalTimeZone();
                if(selectedTimeZone)
                {
                    selectedTimeZone = "";
                }
            }
           
            console.log("Position updated!");
        }
        
        function setLocationMode(bMode)
        {
            if(bMode)
            {
                if(!positionWatch.isOn())
                {
                    map.clickOff();
                    positionWatch.onFirstPostion(function()
                    {
                        locationIcon.html("location_on");
                        showToast("GPS Mode On.");                        
                    });
                    positionWatch.startWatch();
                }
            }
            else
            {
                if(positionWatch.isOn())
                {
                    positionWatch.clearWatch();                    
                }
                map.clickOff();
                map.onClick(function(position)
                {
                    console.log("Map click fired.");
                    if(!longCickFired)
                    {
                        console.log("Clicked at: " + position.latitude + ", " + position.longitude);
                        setLocation(position);
                    }
                    else
                    {
                        longCickFired = false;
                    }
                });
                
                locationIcon.html("location_off");
                showToast("Position in manual mode.");
            }
        }
        
        function onPositionError(error)
        {
            positionWatch.clearWatch();
            console.log("Position UI error:" + error.code);
            
            var dialogBox = new DialogBox("Location Error");

            dialogBox.setOKText("Retry");
            dialogBox.setCloseText("Cancel");
            
            if(error.code === error.PERMISSION_DENIED)
            {
                dialogBox.setDescriptionText("This app requires the use of location information, please enable this feature in the app's permission settings. Click Retry to try again. Otherwise click Cancel.");
                dialogBox.setOKCallBack(function()
                {
                    setLocationMode(true);
                });
                dialogBox.setCloseCallBack(function()
                {
                    setLocationMode(false);
                });
            }
            else if(error.code === error.POSITION_UNAVAILABLE)
            {
                dialogBox.setDescriptionText("Location services are unavailable. Press Cancel to run location in manual mode.  Press retry to try again.");
                dialogBox.setOKCallBack(function()
                {
                    setLocationMode(true);
                });
                dialogBox.setCloseCallBack(function()
                {
                   setLocationMode(false);
                });
            }
            else if(error.code === error.TIMEOUT)
            {
                dialogBox.setDescriptionText("Location services timed out. Press Cancel to run location in manual mode.  Press retry to try again.");
                dialogBox.setCloseCallBack(function()
                {
                    setLocationMode(true);
                });
                dialogBox.setCloseCallBack(function()
                {
                    setLocationMode(false);
                });
            }
            
            material.hideSpinner();
            
            dialogBox.showModal();            
        }
        
        /* Scrolls element to middle of its parent.
         * @param {jQuery} element 
         * @returns {undefined} 
         */
        function scrollToMiddle(/* jQuery */element)
        {
            var parent = element.parent();
            element[0].scrollIntoView();
            var scrollTop = Math.round(parent.scrollTop());
            var scrollHeight = parent[0].scrollHeight;
            var halfHeight = Math.round(parent.height() / 2);
            var endHeight = scrollHeight - Math.round(parent.height()) - Math.round(element.height());
            var elementHeight = Math.round(element.position().top);
            
            if(scrollTop < halfHeight)
            {
                parent.scrollTop(0);
                
            }
            else if(scrollTop > halfHeight && scrollTop < endHeight)
            {
                parent.scrollTop(scrollTop - halfHeight);
            }
            else
            {
                if(elementHeight < halfHeight)
                {
                    parent.scrollTop(scrollTop - halfHeight + (scrollTop - endHeight));
                }
                else
                {
                    parent.scrollTop(scrollHeight);
                }
            }
        }
        
        /* Sets the eclipse information in title bar of app.
         * @param {EclipseData} eclipse
         * @returns {Undefined}  
         */
        function setEclipseTitle(eclipse)
        {
            eclipseTitle.html(eclipse.type + " Solar Eclipse");
            eclipseTitleDate.html(eclipse.maxEclipseDate.toLocaleDateString(TIME_LOCALE, DATE_OPTIONS));
        }
        
        /* Show a toast message.
         * @param {String} msg -- Messae to display in toast.
         * @returns {Undefined}   
         */
        function showToast(/*String */ msg)
        {
            var closeToast = function ()
            {
                // notification.MaterialSnackbar.cleanup_();
                snackBar.classList.remove("mdl-snackbar--active");
            };

            snackBar.MaterialSnackbar.showSnackbar(
                    {
                        message: msg,
                        timeout: TOAST_TIMEOUT,
                        actionText: "Dismiss",
                        actionHandler: closeToast
                    }
            );
        }
        
        function killAnimateWorker()
        {
            shadowAnimator.stop();            
        }
        
        function showAnimationTimes()
        {
            localTimeDiv.addClass("eclipse-map-times-local-trans");
            zuluTimeDiv.addClass("eclipse-map-times-zulu-trans");
        }
        
        function hideAnimationTimes()
        {
            localTimeDiv.removeClass("eclipse-map-times-local-trans");
            zuluTimeDiv.removeClass("eclipse-map-times-zulu-trans");
        }
        
        function inputAnimationTime(date)
        {
            if(selectedTimeZone)
            {
                 localAnimateTime.html(date.toLocaleTimeString("en-US", { timeZone: selectedTimeZone, timeZoneName: 'short' }));
            }
            else
            {
                localAnimateTime.html(date.toLocaleTimeString());
            }
            
            var zuluTimeString = date.toLocaleTimeString("en-US", { timeZone: 'UTC', timeZoneName: 'short' });
            zuluTimeString = zuluTimeString.replace(" GMT", "");
            zuluAnimateTime.html(zuluTimeString);
        }
        
        function startShadowAnimation()
        {
            removeContactPoint();
            mapPositionLockOff(); 
            animateShadowMenuItem.html("Stop Animation");
            inputAnimationTime(currentEclipseRef.getPenumbraStartTime());
            
            showAnimationTimes();
            
            shadowAnimator.start(onShadowComplete, onMoonPosition);
            var centerCoords = {latitude: currentEclipseRef.midEclipsePoint.latitude,
                                longitude: currentEclipseRef.midEclipsePoint.longitude};
           
            if(centerCoords.latitude > 45.0)
            {
                centerCoords.latitude = 45.0;
            }
            if (centerCoords.latitude < -45.0)
            {
                centerCoords.latitude = -45.0;
            }

            map.setCenter(centerCoords);
            map.setZoom(3);
        }
        
        function startRealTimeAnimation()
        {
            removeContactPoint();
            realtimeShadowMenuItem.hide();
            realTimeInfoID.addClass("eclipse-realtime-shadow-trans");
            animateShadowMenuItem.html("Stop Animation");
            inputAnimationTime(currentEclipseRef.getPenumbraStartTime());
            
            showAnimationTimes();
            
            shadowAnimator.start(onShadowComplete, onMoonPosition, {realTime: true, dateOffset: dateOffset});
        }
        
        function stopShadowAnimation()
        {
            checkIfEclipseIsOccurring(true);
            realTimeInfoID.removeClass("eclipse-realtime-shadow-trans");
            hideAnimationTimes();
            animateShadowMenuItem.html("Animate Shadow");
            killAnimateWorker();
            penumbraShadow = map.removeFeature(penumbraShadow);
            umbraShadow = map.removeFeature(umbraShadow);
            console.log("Animation stopped.");
        }
        
        function onMoonPosition(data)
        {
            moonPos = data.moon_pos;
            sunPos = data.sun_pos;
            updateMoonPosition();
        }
        
        function updateMoonPosition()
        {
            var displaySunWidth = sun.width();
            var moonPixelCenter = sun.offset();
            var moonWidth = displaySunWidth;
            
            moonWidth = moonPos.diameter / sunPos.diameter * displaySunWidth;
            var pixelPerDeg = displaySunWidth / sunPos.diameter;
            
            var deltaDecl = moonPos.decl - sunPos.decl;
            var deltaRA = moonPos.ra - sunPos.ra;
           
           
            moonPixelCenter.top = moonPixelCenter.top - ( (deltaDecl) * pixelPerDeg) - 1;  // For some reason there's a rounding issue here, this seems to help, not sure why.
            moonPixelCenter.left = moonPixelCenter.left - ( (deltaRA) * pixelPerDeg);
            
            moon.width(moonWidth);
            moon.height(moonWidth);

            moon.offset(moonPixelCenter);  
            showMoon();
        }
        
        function showMoon()
        {
            if(!moon.hasClass("eclipse-moon-visible"))
            {
                moon.addClass("eclipse-moon-visible");
            }
        }
        
        function hideMoon()
        {
            moon.removeClass("eclipse-moon-visible");
        }
                       
        function onShadowComplete(data)
        {
            if (data.umb_shadow !== null)
            {
                if(!umbraShadow)
                {
                    umbraShadow = map.addPolygon(data.umb_shadow, {fill_color: 'rgba(0, 0, 0, 0.75)'});
                }
                else
                {
                    umbraShadow.setCoordinates(data.umb_shadow);
                }
            }
            else
            {
                umbraShadow = map.removeFeature(umbraShadow);
            }
            
            if (data.pen_shadow !== null)
            {
                if(!penumbraShadow)
                {
                    penumbraShadow = map.addPolygon(data.pen_shadow, {fill_color: 'rgba(0, 0, 0, .2)'});
                }
                else
                {
                    penumbraShadow.setCoordinates(data.pen_shadow);
                }
            }
            else
            {
                penumbraShadow = map.removeFeature(penumbraShadow);
            }
            
            inputAnimationTime(data.date);
        }
        
        this.init = function()
        {
            jMap.height(mapHeight);
            material.disableSwipe(1);
            
            /**
            map.setView(START_COORDS, START_ZOOM);
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            **/
            
            bindEvents();
            firstRun();
            checkZooms();
            
            loadEclipseData();            
        };
    }
};

class WatchPosition
{
    constructor()
    {
        var errorCode = 0;
        var DEFAULT_COORDS = {  laitude: 34.0,
                                longitude: -118.0,
                                altitude: 0.0
                            };
        var coords;
        var errorCallBack;
        var posCallBack;
        var firstPositionCallBack = null;
        
        var GEO_OPTIONS = 
        {
            enableHighAccuracy: true,
            maximumAge: 30000,
            timeout: 27000
        };
        
        var watchID = null;
       
        function _clearWatch()
        {
            if(watchID)
            {
                navigator.geolocation.clearWatch(watchID);
                watchID = null;
            }
        }
        
        function onSuccess(position) 
        {
            if(firstPositionCallBack)
            {
                firstPositionCallBack(position.coords);
                firstPositionCallBack = null;            
            }
            
            coords = position.coords;
            if(posCallBack)
            {
                posCallBack(position.coords);
            }
        }

        function onError(error) 
        {
            console.log(error.message);
            _clearWatch();
            
            if(errorCallBack)
            {
                errorCallBack(error);
            }
        }
        
        /*
         * Returns position error code.
         * @returns {Number}
         */
        this.getError = function()
        {
            return errorCode;
        };
        
        /* Return current position.
         * @returns {Coordinates} 
         */
        this.getPosition = function()
        {
            if(coords)
            {
                return coords;
            }
            
            return DEFAULT_COORDS;
        };
        
        /*
         * Is watch position currently on?
         * @returns {Boolean}
         */
        this.isOn = function()
        {
            if(watchID)
            {
                return true;
            }
            
            return false;
        };
        
        this.setErrorCall = function(callback)
        {
            errorCallBack = callback;                        
        };
        
        this.setPositionCall = function(callback)
        {
            posCallBack = callback;
        };
        
        this.onFirstPostion = function(callback)
        {
            firstPositionCallBack = callback;
        };
        
        /*
         * Start position watch.
         * @returns {undefined}
         */
        this.startWatch = function()
        {
            if(!watchID)
            {
                watchID = navigator.geolocation.watchPosition(onSuccess, onError, GEO_OPTIONS);
            }
        };
        
        /*
         * Stops position watch.
         * @returns {undefined}
         */
        this.clearWatch = function()
        {
            _clearWatch();
        };
    }
};

$(function()
{
    var eclipse = new EclipseUI;
    
    eclipse.init();
    
});


