
   * This is template directive with draggable and droppable.
   * The directive return the re-arranged output with it's model. 
   
   
   * calling of directive
         <zi-template-generator data="templateData"></zi-template-generator> 


   * Attributes: data="[]" 
      The data attribute input array of object.
      Example: 
     
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
