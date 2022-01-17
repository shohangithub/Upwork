angular.module("demo", ["ziDragAndDropModule"])
    .controller("CustomController", function ($scope) {

        $scope.templateData = [{
            "field": "title",
            "bg_color": "#fffff"
        },
        {
            "field": "description",
            "bg_color": "#cf8181"
        },
        {
            "field": "sku",
            "bg_color": "#000000"
        }]
    });
