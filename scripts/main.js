// Update Kris 
var map;
var infoWindow;
var locations = {};
var markers = [];

const locationIcon = "map-marker-stop.svg";
const DEFAULT_ZOOM = 18;
const MAIN_URL_PARAMS_SEPARATOR = "?";
const TOUR_URL_PARAMS_SEPARATOR = "#";
const LOADING_DELAY_MS = 100;


let categories = {};
let categoriesByOrder = []; // string[]
let locationsByOrder = []; // string[]
let categoryFilters = []; // string[]
const IMAGE_PATH = 'http://www.messiah.edu/images/';

const filtersURLParam = "filters";
const stopURLParam = "stop";
const highlightURLParam = "highlight";
const forwardURLParam = "forward";
let navigationMode = false;

function hideKeyboard(element) {
  element.attr('readonly', 'readonly'); // Force keyboard to hide on input field.
  element.attr('disabled', 'true'); // Force keyboard to hide on textarea field.
  setTimeout(function() {
    element.blur();  //actually close the keyboard
    // Remove readonly attribute after keyboard is hidden.
    element.removeAttr('readonly');
    element.removeAttr('disabled');
  }, 100);
}

function updateLocations() {
  const filteredLocations = categoryFilters.length === 0
      ? [...locationsByOrder]
      : categoryFilters.reduce((prev, curr) => [...prev, ...categories[curr].mainStopNos], [])
  $(".toursList").html("");
  for (const key of locationsByOrder) {
    locations[key].main.marker.setVisible(false);
    if(filteredLocations.includes(key) && locations[key].main.categoryId){
      $("#tourEntryTemplate").tmpl({
        ...locations[key].main,
        categoryName: categories[locations[key].main.categoryId].name
      }).appendTo(".toursList");

      locations[key].main.marker.setVisible(true);
    }
  }
}


function getURLParameter(sParam) {
  var result = '';
  var sPageURL = window.location.search.substring(1);
  var sURLVariables = sPageURL.split('&');
  for (var i = 0; i < sURLVariables.length; i++) {
    var sParameterName = sURLVariables[i].split('=');
    if (sParameterName[0] == sParam) {
      result = sParameterName[1];
      break;
    }
  }
  return result;
}//getURLParameter

function updateURLParameter(param, value) {
  const urlQuerySplit = window.location.href.split(MAIN_URL_PARAMS_SEPARATOR);
  const newParam = value !== 0 && !value ? [] : [[param, value].join("=")];
  const urlParams = urlQuerySplit[1]
      ? [...urlQuerySplit[1]
          .split("&").filter(val => !val.startsWith(`${param}=`))
        , ...newParam].join("&")
      : newParam.join("");
  const newURL = urlParams === "" ? urlQuerySplit[0] : [urlQuerySplit[0], urlParams].join(MAIN_URL_PARAMS_SEPARATOR);
  window.history.replaceState(null,null, newURL);
}

function isNumber(value) {
  return typeof value === "number";
}

function addForwardParams(url) {
  if(!url) {
    return url;
  }
  const urlQuerySplit = window.location.href.split(MAIN_URL_PARAMS_SEPARATOR);

  if(!urlQuerySplit[1]){
    return url;
  }

  const params = urlQuerySplit[1].split("&").filter(val => val.startsWith(`forward=`));
  if(params.length === 0) {
    return url;
  }

  return addURLParams(url, params);
}

// TODO remove repeated variables
function addURLParams(url, params) {
  return params.reduce((prev, curr) => prev + (prev.includes(TOUR_URL_PARAMS_SEPARATOR) ? "&" : TOUR_URL_PARAMS_SEPARATOR) + curr.replace(`forward=`, ""), url);
}

const navButton = Object.freeze({
  previous:"previous", next:"next", none:"none"
});

function openStop(location, highlight=null, forwardParams=null, navButtonHit=navButton.none) {

  const isHighlight = isNumber(highlight);

  updateURLParameter(stopURLParam, location.main.stopNo);
  if(isHighlight){
    updateURLParameter(highlightURLParam, highlight);
  }
  else{
    updateURLParameter(highlightURLParam, null);
  }

  if(navigationMode) {
    updateURLParameter(forwardURLParam, null);
  }

  const stopIndex = locationsByOrder.indexOf(location.main.stopNo);
  const locationKeys = isHighlight
      ? { stop: location.main.stopNo, highlight }
      : { stop: location.main.stopNo, highlight: -1 };
  const maxKeys = locations[locationsByOrder[locationsByOrder.length - 1]].highlights
      ? { stop: locationsByOrder[locationsByOrder.length - 1], highlight: locations[locationsByOrder[locationsByOrder.length - 1]].highlights.length - 1 }
      : { stop: locationsByOrder[locationsByOrder.length - 1], highlight: -1 };

  const hasPrevLocation = stopIndex > 0 || locationKeys.highlight > -1
  const prevLocationKeys = hasPrevLocation
      ? !isHighlight
          ? { stop: locationsByOrder[stopIndex - 1], highlight: locations[locationsByOrder[stopIndex - 1]].highlights.length - 1 }
          : { stop: locationKeys.stop, highlight: locationKeys.highlight - 1 }
      : locationKeys;

  const hasNextLocation = stopIndex < locationsByOrder.length - 1 || locationKeys.highlight < maxKeys.highlight
  const nextLocationKeys = hasNextLocation
      ? locationKeys.highlight === location.highlights.length - 1
          ? { stop: locationsByOrder[stopIndex + 1], highlight: -1 }
          : { stop: locationKeys.stop, highlight: locationKeys.highlight + 1 }
      : locationKeys;

  const loc = !isHighlight ? location.main : location.highlights[highlight];
  var contentString = $("#locationInfoTemplate").tmpl(
      {...loc,
        isHighlight,
        prevLocationStop: prevLocationKeys.stop,
        prevLocationHighlight: prevLocationKeys.highlight === -1 ? "null" : prevLocationKeys.highlight,
        hasPrevLocation,
        nextLocationStop: nextLocationKeys.stop,
        nextLocationHighlight: nextLocationKeys.highlight === -1 ? "null" : nextLocationKeys.highlight,
        hasNextLocation,
      }).html();
  $("#infoDrawerContent").html(contentString);

  if(!isHighlight && location.highlights.length > 0){
    var highlightContent = $("#buildingHighlightsTemplate").tmpl(
        location).html();
    $("#buildingHighlights").html(highlightContent);
  }
  // TODO Continue from here

  $("#infoDrawer").show();
  switch(navButtonHit) {
    case "previous":
      document.getElementById('nextTour').id = "tempTour";
      document.getElementById('thisTour').id = "nextTour";
      document.getElementById('previousTour').id = "thisTour";
      document.getElementById('tempTour').id = "previousTour";
      if(hasPrevLocation) {
        document.getElementById('previousTour').src = prevLocationKeys.highlight === -1
            ? location.main.tour
            : locations[prevLocationKeys.stop].highlights[prevLocationKeys.highlight].tour;
      }
      break;
    case "next":
      document.getElementById('previousTour').id = "tempTour";
      document.getElementById('thisTour').id = "previousTour";
      document.getElementById('nextTour').id = "thisTour";
      document.getElementById('tempTour').id = "nextTour";
      if(hasNextLocation) {
        document.getElementById('nextTour').src = nextLocationKeys.highlight === -1
            ? locations[nextLocationKeys.stop].main.tour
            : locations[nextLocationKeys.stop].highlights[nextLocationKeys.highlight].tour;
      }
      break;
    default:
      document.getElementById('thisTour').src = forwardParams === null
          ? addForwardParams(loc.tour)
          : addURLParams(loc.tour, forwardParams);

      if(hasNextLocation) {
        setTimeout(function(){
          document.getElementById('nextTour').src = nextLocationKeys.highlight === -1
              ? locations[nextLocationKeys.stop].main.tour
              : locations[nextLocationKeys.stop].highlights[nextLocationKeys.highlight].tour;
        }, LOADING_DELAY_MS);
      }
      if(hasPrevLocation) {
        setTimeout(function(){
          document.getElementById('previousTour').src = prevLocationKeys.highlight === -1
              ? location.main.tour
              : locations[prevLocationKeys.stop].highlights[prevLocationKeys.highlight].tour;
        }, LOADING_DELAY_MS);
      }

      break;
  }

  $('.viewTourButton').on('click', function(){
    $('#thisTour').toggleClass("openMobile");
    $('#backToInfoButton').toggleClass("openMobile");
  });

  $("#map").hide();
  $("#mainSidebarWrapper").hide();
}

function refreshMap() {
  const newZoom = DEFAULT_ZOOM-1;
  map.setZoom(newZoom === 0 ? DEFAULT_ZOOM+1 : newZoom);
  map.setZoom(DEFAULT_ZOOM);
}

function openMap(isMenuOpen=false) {
  document.getElementById('map').setAttribute("style", "visibility: visible;");

  updateURLParameter(stopURLParam, null);
  updateURLParameter(highlightURLParam, null);
  $("#map").show();
  $("#mainSidebarWrapper").show();

  $("#infoDrawer").hide();
  $("#thisTour").attr("src","");
  $("#previousTour").attr("src","");
  $("#nextTour").attr("src","");

  refreshMap();

  if(isMenuOpen) {
    $('.tabsContainer').addClass("openMobile");
    $(".toggleTourList").addClass("openMobile");
    $('#mainSidebarWrapper').addClass("openMobile");

    $('header.mainHeader .mainFilterList').removeClass("openMobile");
    $('.toggleFilterList').removeClass("openMobile");
  }
}

$(document).ready(function(){

  let getFilters = getURLParameter(filtersURLParam).split(",");
  let getStop = getURLParameter(stopURLParam);
  let getHighlight = getURLParameter(highlightURLParam);

  let url =  "https://www.messiah.edu/site/a/api/directoriesByCategoryJSONP.php?apiKey=a38737a6a302f5f0390169114b6640a6&directoryID=21&categoryID=-1&callback=directory_data";
  $.ajax({
    url: url,
    dataType: 'jsonp',
    jsonpCallback: 'directory_data',
    jsonp: 'callback',
    success: function (data) {

      data.forEach((locationRaw)=>{
        if(locationRaw.live === "1") {
          const coords = locationRaw.stop_location.split(",").map(val=>+val);
          const position = new google.maps.LatLng(...coords);
          const marker = new google.maps.Marker({position,
            map, icon: {
              url: "images/" +locationIcon,
              labelOrigin: new google.maps.Point(20,20),
              anchor: new google.maps.Point(20,55),
              size: new google.maps.Size(40,64)
            },
            label: {
              text: locationRaw.stop_number,
              fontSize: "22px",
              color: "#FFFFFF",
              fontFamily: "'Aptifer Sans LT W01', sans-serif"
          }});


          let location = {
            name: locationRaw.entry_title || undefined,
            description: locationRaw.stop_description || undefined,
            stopNo: locationRaw.stop_number || "-1",
            banner: locationRaw.banner_image ? IMAGE_PATH + locationRaw.banner_image : undefined,
            tour: locationRaw.stop_pano_image_url || undefined,
            coordinates: {
              latitude: position.lat() || undefined,
              longitude: position.lng() || undefined,
            },
            categoryId: locationRaw.category_id,
            marker
          };
          marker.setVisible(false);

          if(locationRaw.building_highlight === "yes") {
            locations[location.stopNo] = {
                  main: locations[location.stopNo] && locations[location.stopNo].main,
                  highlights: locations[location.stopNo]
                      && Array.isArray(locations[location.stopNo].highlights)
                      && [...locations[location.stopNo].highlights, location] || [location]}
          }
          else if(locationRaw.category_id && locationRaw.category_name) {
            locations[location.stopNo] = {
              main: location,
                  highlights: locations[location.stopNo]
            && Array.isArray(locations[location.stopNo].highlights)
            && locations[location.stopNo].highlights || []
            }
            !locationsByOrder.includes(location.stopNo) && (locationsByOrder = [...locationsByOrder, location.stopNo]);
            marker.addListener('click', function() {
              openStop(locations[location.stopNo]);
            });

            categories[locationRaw.category_id] = {
              id: locationRaw.category_id,
              name: locationRaw.category_name,
              mainStopNos: categories[locationRaw.category_id]
                  && [...categories[locationRaw.category_id].mainStopNos, location.stopNo]
                  || [location.stopNo]
            }
            !categoriesByOrder.includes(locationRaw.category_id)
            && (categoriesByOrder = [...categoriesByOrder, locationRaw.category_id]);
          }
        }});

        getFilters.forEach(val=>{
          if(categoriesByOrder.includes(val)){
            categoryFilters = [...categoryFilters, val];
          }
        });

        $(".mainFilterList").html("");
        for (const key of categoriesByOrder) {
          $("#filterEntryTemplate").tmpl(
              {...categories[key], checked: categoryFilters.includes(key)
                    ? "checked"
                    : ""}).appendTo(".mainFilterList");
        }

        locationsByOrder = locationsByOrder.sort((a,b) => +a - +b);
        updateLocations();

        // GO TO STOP

        const goToStop = locations[getStop];

        if(goToStop) {
          const goToHighlight = goToStop.highlights[getHighlight];
          openStop(goToStop,
              !goToHighlight ? null : +getHighlight);
        }
        else {

          document.getElementById('map').setAttribute("style", "visibility: visible;");
        }
        navigationMode = true;

        $('#backToInfoButton').on('click', function(){
          $('#thisTour').toggleClass("openMobile");
          $('#backToInfoButton').toggleClass("openMobile");
        });
    },
    error: function(jqXHR, textStatus, errorThrown) {
      //alert(jqXHR.resultText);
    }
  });

  // CATEGORY FILTERS


  $(document).on('click', ".filterCheckbox", function(event) {
    event.stopPropagation();
    if(event.currentTarget.checked){
      if(!categoryFilters.includes(event.currentTarget.value)) {
        categoryFilters = [...categoryFilters, event.currentTarget.value]
        updateLocations();
      }
    }
    else {
      if(categoryFilters.includes(event.currentTarget.value)) {
        categoryFilters = categoryFilters.reduce((prev, curr) => curr === event.currentTarget.value ? prev : [...prev, curr], []);
        updateLocations();
      }
    }

    updateURLParameter(filtersURLParam, categoryFilters.join(","))

  });


  // LOCATION ENTRIES

  $(document).on('click', ".location-entry", function(event) {
    event.stopPropagation();
    var stop = $(this).attr("data-id");

    openStop(locations[stop]);
  });

  // MENU

  $('#mainSidebarToggle').click(toggleMenuDrawer("#mainSidebarToggle", "#mainSidebarWrapper"));
  $('#infoSidebarToggle').click(toggleMenuDrawer("#infoSidebarToggle", "#infoDrawer"));

  // MOBILE

  $('.toggleTourList').on('click', function(){
    $('.tabsContainer').toggleClass("openMobile");
    $(this).toggleClass("openMobile");
    $('#mainSidebarWrapper').toggleClass("openMobile");

    $('header.mainHeader .mainFilterList').removeClass("openMobile");
    $('.toggleFilterList').removeClass("openMobile");
  });

});

function toggleMenuDrawer(toggleId, drawerId, toClose=false) {
  return function (ev){
    ev.stopPropagation();
    var MenuDrawerToggle = $(toggleId);
    const isClosed = MenuDrawerToggle[0].classList.contains('closed');
    if (!toClose || !isClosed) {
      MenuDrawerToggle.toggleClass('closed');
      MenuDrawerToggle.find('> span').toggleClass('icon-doublearrow-left icon-doublearrow-right');
      $(drawerId).toggleClass('closed');
      $(".tourContainer").toggleClass('expand');
    }
  }
}

function toggleFilterList() {
  $("#filterListSection").toggleClass("collapse");
}

function isInMobile(){
  return window.innerWidth <= 480;
}


function initMap() {
  document.getElementById('map').setAttribute("style", "visibility: hidden;");
  map = new google.maps.Map(document.getElementById('map'), {
    center: isInMobile() ? {lat: 40.157535, lng: -76.989000} : {lat: 40.158035, lng: -76.990474},
    zoom: DEFAULT_ZOOM,
    mapTypeId: google.maps.MapTypeId.SATELLITE,
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.TOP_RIGHT
    },
    mapTypeControl: false,
    scaleControl: false,
    streetViewControl: false,
    rotateControl: false
  });

  // Bounds of the map overlay tiles (in different zooms)
  var bounds = {
    15: [[9375, 9377], [12385, 12387]],
    16: [[18750, 18754], [24771, 24774]],
    17: [[37501, 37509], [49542, 49548]],
    18: [[75003, 75018], [99085, 99097]],
    19: [[150007, 150037], [198170, 198195]],
    20: [[300015,300075],[396340,396390]]
  };

  // Map overlay handler
  var imageMapType = new google.maps.ImageMapType({
    getTileUrl: function(coord, zoom) {

      if (zoom < 15 || zoom > 20 ||
          bounds[zoom][0][0] > coord.x || coord.x > bounds[zoom][0][1] ||
          bounds[zoom][1][0] > coord.y || coord.y > bounds[zoom][1][1]) {
        return null;
      }

      return ['./tiles/',
        zoom, '/tile_', coord.x, 'x', coord.y, '.png'].join('');
    },
    tileSize: new google.maps.Size(256, 256)
  });

  // Adding overlay handler to map
  map.overlayMapTypes.push(imageMapType);

  infoWindow = new google.maps.InfoWindow({ maxWidth: 350 });
  google.maps.event.addListener(infoWindow, 'domready', function() {
    // Reference to the DIV that wraps the bottom of infowindow
    var iwOuter = $('.gm-style-iw');

    /* Since this div is in a position prior to .gm-div style-iw.
     * We use jQuery and create a iwBackground variable,
     * and took advantage of the existing reference .gm-style-iw for the previous div with .prev().
    */
    var iwBackground = iwOuter.prev();

    // Removes background shadow DIV
    iwBackground.children(':nth-child(2)').css({'display' : 'none'});

    // Removes white background DIV
    iwBackground.children(':nth-child(4)').css({'display' : 'none'});

    // Moves the infowindow 115px to the right.
    //iwOuter.parent().parent().css({left: '115px'});

    // Moves the shadow of the arrow 76px to the left margin.
    //iwBackground.children(':nth-child(1)').attr('style', function(i,s){ return s + 'left: 76px !important;'});

    // Moves the arrow 76px to the left margin.
    //iwBackground.children(':nth-child(3)').attr('style', function(i,s){ return s + 'left: 76px !important;'});

    // Changes the desired tail shadow color.
    iwBackground.children(':nth-child(3)').find('div').children().css({'box-shadow': '#293e5d 0px 1px 6px', 'z-index' : '1'});

    // Reference to the div that groups the close button elements.
    var iwCloseBtn = iwOuter.next();

    // If the content of infowindow not exceed the set maximum height, then the gradient is removed.
    if($('.iw-content').height() < 140){
      $('.iw-bottom-gradient').css({display: 'none'});
    }
  });
}//initMap
