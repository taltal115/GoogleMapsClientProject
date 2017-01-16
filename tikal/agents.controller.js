'use strict';

var app = angular.module('agentsApp', []) // allow DI for use in controllers, unit tests
    .constant('_', window._)
    // use in views, ng-repeat="x in _.range(3)"
    .run(function ($rootScope) {
        $rootScope._ = window._;
    });

app.controller('agentsController', ['$scope','StaticData','$http','$q',
    function($scope, StaticData, $http, $q) {
        $scope.data                 = StaticData.data;
        $scope.sortType             = 'date'; // set the default sort type
        $scope.sortReverse          = true;  // set the default sort order
        $scope.winnerCountry        = null;  // set the default sort order
        $scope.list                 = [];
        $scope.locationCon = [];

        var agentsObj = {},
            countriesObj = {},
            mostIsolatedCountry;
        /**************************  Task A  *****************************/

        $scope.data.forEach(function(val){
            if(agentsObj[val.agent]) {
                agentsObj[val.agent].push(val);
            } else {
                agentsObj[val.agent] = [val];
            }
        });

        $scope.findIsolatedCountry = function(callback){
            _.each(agentsObj, function(agents){
                if(agents.length == 1) {
                    if(countriesObj[agents[0].country]) {
                        countriesObj[agents[0].country].push(agents);
                    } else {
                        countriesObj[agents[0].country] = [agents];
                    }
                }
            });

            var maxl = 0;
            _.each(countriesObj, function(countryArr, name){
                if(maxl < countryArr.length) {
                    maxl = countryArr.length;
                    mostIsolatedCountry = countryArr;
                }
            });
            mostIsolatedCountry = _.flatten(mostIsolatedCountry)[0].country;
            callback(null, mostIsolatedCountry);
        };

        $scope.initTaskA = function() {
            $scope.findIsolatedCountry(function(err, res){
                $scope.winnerCountry = res;
            });
        };
        $scope.initTaskA();

        /**************************  Task B  *****************************/
        function calcDistance(){
            var p = null;
            var locationCon = [];
            _.each($scope.data, function(val) {

                var googleAddress = null;
                if (val.address.indexOf('Riad Sultan 19') >= 0) {
                    googleAddress = 'Tangier+' + val.country;
                } else if (val.address.indexOf('atlas marina beach') >= 0) {
                    googleAddress = 'agadir+' + val.country;
                } else {
                    googleAddress = (val.address + ',+' + val.country).replace(/ /g, "+");
                }

                p = $http({
                    method: 'GET',
                    url: 'https://maps.google.com/maps/api/geocode/json?address=' + googleAddress
                }).then(function successCallback(response) {
                    if (response.data.results.length && response.data.results[0].geometry) {
                        var origin = new google.maps.LatLng(51.5047124802915, -0.126275819708498);
                        var dest = new google.maps.LatLng(response.data.results[0].geometry.location.lat, response.data.results[0].geometry.location.lng);
                        locationCon.push({
                            googleAddress: googleAddress.replace(new RegExp("\\+","g"),''),
                            realAddress: val.address + ', ' + val.country,
                            lat: response.data.results[0].geometry.location.lat,
                            lng: response.data.results[0].geometry.location.lng,
                            dist: google.maps.geometry.spherical.computeDistanceBetween(origin, dest)
                        });
                        return locationCon;
                    } else {
                        console.error("googleAddress: ", googleAddress);
                        return 'error';
                    }
                });

            });
            return p;
        }

        calcDistance().then(function(res){
            document.getElementsByClassName('loading')[0].style.display = 'none';
            var distanceArr = [];
            _.each(res, function(val) {
                distanceArr.push(val);

            });
            var tmp = {
                max:_.max(distanceArr, function(item){ return item.dist}),
                min:_.min(distanceArr, function(item){ return item.dist})
            };
           
            var maxRow = document.getElementsByClassName(tmp.max.googleAddress);
            var minRow = document.getElementsByClassName(tmp.min.googleAddress);
            maxRow[0].style.color = 'red';
            minRow[0].style.color = 'green';

            var bounds = new google.maps.LatLngBounds;
            var markersArray = [];
            var origin = '10 Downing st. London';

            var tmpArr = [];
            distanceArr.forEach(function(iter){
                tmpArr.push(iter.realAddress)
            });

            var destinationIcon = 'https://chart.googleapis.com/chart?' +
                'chst=d_map_pin_letter&chld=D|FF0000|000000';
            var originIcon = 'https://chart.googleapis.com/chart?' +
                'chst=d_map_pin_letter&chld=O|FFFF00|000000';
            var map = new google.maps.Map(document.getElementById('map'), {
                center: {lat: 55.53, lng: 9.4},
                zoom: 10
            });
            var geocoder = new google.maps.Geocoder;

            var service = new google.maps.DistanceMatrixService;
            service.getDistanceMatrix({
                origins: [origin],
                // destinations: [destinationA, destinationB],
                destinations: tmpArr,
                travelMode: 'DRIVING',
                unitSystem: google.maps.UnitSystem.METRIC,
                avoidHighways: false,
                avoidTolls: false
            }, function(response, status) {
                if (status !== 'OK') {
                    alert('Error was: ' + status);
                } else {
                    var originList = response.originAddresses;
                    var destinationList = response.destinationAddresses;
                    deleteMarkers(markersArray);

                    var showGeocodedAddressOnMap = function(asDestination) {
                        var icon = asDestination ? destinationIcon : originIcon;
                        return function(results, status) {
                            if (status === 'OK') {
                                map.fitBounds(bounds.extend(results[0].geometry.location));
                                markersArray.push(new google.maps.Marker({
                                    map: map,
                                    position: results[0].geometry.location,
                                    icon: icon
                                }));
                            } else {
                                alert('Geocode was not successful due to: ' + status);
                            }
                        };
                    };

                    for (var i = 0; i < originList.length; i++) {
                        var results = response.rows[i].elements;
                        geocoder.geocode({'address': originList[i]},
                            showGeocodedAddressOnMap(false));
                        for (var j = 0; j < results.length; j++) {
                            geocoder.geocode({'address': destinationList[j]},
                                showGeocodedAddressOnMap(true));
                        }
                    }
                }
            });
        });
        
        function deleteMarkers(markersArray) {
            for (var i = 0; i < markersArray.length; i++) {
                markersArray[i].setMap(null);
            }
            markersArray = [];
        }
    }
]).factory('StaticData', [
    function () {
        var factory = {};

        factory.data =
            [
                {
                    agent: "007",
                    country: "Brazil",
                    address: 'Avenida Vieira Souto 168 Ipanema, Rio de Janeiro',
                    date: 'Dec 17, 1995, 9:45:17 PM'
                },
                {
                    agent: '005',
                    country: 'Poland',
                    address: 'Rynek Glowny 12, Krakow',
                    date: 'Apr 5, 2011, 5:05:12 PM'
                },
                {
                    agent: '007',
                    country: 'Morocco',
                    address: '27 Derb Lferrane, Marrakech',
                    date: 'Jan 1, 2001, 12:00:00 AM'
                },
                {
                    agent: '005',
                    country: 'Brazil',
                    address: 'Rua Roberto Simonsen 122, Sao Paulo',
                    date: 'Sao Paulo	May 5, 1986, 8:40:23 AM'
                },
                {
                    agent: '011',
                    country: 'Poland',
                    address: 'swietego Tomasza 35, Krakow',
                    date: 'Krakow	Sep 7, 1997, 7:12:53 PM'
                },
                {
                    agent: '003',
                    country: 'Morocco',
                    address: 'Rue Al-Aidi Ali Al-Maaroufi, Casablanca',
                    date: 'Aug 29, 2012, 10:17:05 AM'
                },
                {
                    agent: '008',
                    country: 'Brazil',
                    address: 'Rua tamoana 418, tefe',
                    date: 'Nov 10, 2005, 1:25:13 PM'
                },
                {
                    agent: '013',
                    country: 'Poland',
                    address: 'Zlota 9, Lublin',
                    date: 'Oct 17, 2002, 10:52:19 AM'
                },
                {
                    agent: '002',
                    country: 'Morocco',
                    address: 'Riad Sultan 19, Tangier',
                    date: 'Jan 1, 2017, 5:00:00 PM'
                },
                {
                    agent: '009',
                    country: 'Morocco',
                    address: 'atlas marina beach, agadir',
                    date: 'Dec 1, 2016, 9:21:21 PM'
                }
            ];

        return factory;
    }
]).filter('removeSpaces', [function() {
    return function(string) {
        if (!angular.isString(string)) {
            return string;
        }
        return string.replace(/[\s]/g, '');
    };
}]);
