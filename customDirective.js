
(function (ziDragAndDropModule) {
  var MIME_TYPE = 'application/x-zi';
  var EDGE_MIME_TYPE = 'application/json';
  var MSIE_MIME_TYPE = 'Text';

  // All valid HTML5 drop effects, in the order in which we prefer to use them.
  var ALL_EFFECTS = ['move', 'copy', 'link'];

  ziDragAndDropModule.directive('ziTemplateGenerator', ['$rootScope', function ($rootScope) {
    return {
      restrict: 'E',
      replace: true,
      scope: {
        data: "=",
      },
      templateUrl: `template.html`,
      link: function (scope) {

        // create directive model
        scope.ziModels = {
          selected: null,
          list: scope.data
        };

        // create new directive object
        scope.ziAddNewTemplete = function () {
          try {
            scope.ziModels.list.push(
              {
                field: null,
                bg_color: null
              },
            );
          } catch (error) {
            throw error;
          }
        }


        // remove a directive object
        scope.ziRemoveTemplete = function (item, index) {
          try {
            scope.ziModels.list.splice(index, 1)
          } catch (error) {
            throw error;
          }
        }


        // open color picker onclick input
        scope.ziOpenColorPicker = function ($event) {
          try {
            var colorPickerElement = $event.currentTarget.nextElementSibling;
            if (colorPickerElement) {
              setTimeout(function(){
                colorPickerElement.click()
              },50)
            }
          } catch (error) {
            throw error;
          }
        }


        // Model to JSON for demo purpose
        scope.$watch('ziModels', function (model) {
          scope.modelAsJson = angular.toJson(model.list, true);
        }, true);
        
      }
    };
  }]);

  ziDragAndDropModule.directive('ziDraggable', ['$parse', '$timeout', function ($parse, $timeout) {
    return function (scope, element, attr) {
      // Set the HTML5 draggable attribute on the element.
      element.attr("draggable", "true");

      // If the zi-disable-if attribute is set, we have to watch that.
      if (attr.ziDisableIf) {
        scope.$watch(attr.ziDisableIf, function (disabled) {
          element.attr("draggable", !disabled);
        });
      }

      /**
       * When the drag operation is started we have to prepare the dataTransfer object,
       * which is the primary way we communicate with the target element
       */
      element.on('dragstart', function (event) {
        event = event.originalEvent || event;

        // Check whether the element is draggable, since dragstart might be triggered on a child.
        if (element.attr('draggable') == 'false') return true;

        // Initialize global state.
        ziState.isDragging = true;
        ziState.itemType = attr.ziType && scope.$eval(attr.ziType).toLowerCase();

        // Set the allowed drop effects. See below for special IE handling.
        ziState.dropEffect = "none";
        ziState.effectAllowed = attr.ziEffectAllowed || ALL_EFFECTS[0];
        event.dataTransfer.effectAllowed = ziState.effectAllowed;

        // Internet Explorer and Microsoft Edge don't support custom mime types, see design doc:
        // https://github.com/marceljuenemann/angular-drag-and-drop-lists/wiki/Data-Transfer-Design
        var item = scope.$eval(attr.ziDraggable);
        var mimeType = MIME_TYPE + (ziState.itemType ? ('-' + ziState.itemType) : '');
        try {
          event.dataTransfer.setData(mimeType, angular.toJson(item));
        } catch (e) {
          // Setting a custom MIME type did not work, we are probably in IE or Edge.
          var data = angular.toJson({ item: item, type: ziState.itemType });
          try {
            event.dataTransfer.setData(EDGE_MIME_TYPE, data);
          } catch (e) {
            // We are in Internet Explorer and can only use the Text MIME type. Also note that IE
            // does not allow changing the cursor in the dragover event, therefore we have to choose
            // the one we want to display now by setting effectAllowed.
            var effectsAllowed = filterEffects(ALL_EFFECTS, ziState.effectAllowed);
            event.dataTransfer.effectAllowed = effectsAllowed[0];
            event.dataTransfer.setData(MSIE_MIME_TYPE, data);
          }
        }

        // Add CSS classes. See documentation above.
        element.addClass("ziDragging");
        $timeout(function () { element.addClass("ziDraggingSource"); }, 0);

        // Try setting a proper drag image if triggered on a zi-handle (won't work in IE).
        if (event._ziHandle && event.dataTransfer.setDragImage) {
          event.dataTransfer.setDragImage(element[0], 0, 0);
        }

        // Invoke dragstart callback and prepare extra callback for dropzone.
        $parse(attr.ziDragstart)(scope, { event: event });
        if (attr.ziCallback) {
          var callback = $parse(attr.ziCallback);
          ziState.callback = function (params) { return callback(scope, params || {}); };
        }

        event.stopPropagation();
      });

      /**
       * The dragend event is triggered when the element was dropped or when the drag
       * operation was aborted (e.g. hit escape button). Depending on the executed action
       * we will invoke the callbacks specified with the zi-moved or zi-copied attribute.
       */
      element.on('dragend', function (event) {
        event = event.originalEvent || event;

        // Invoke callbacks. Usually we would use event.dataTransfer.dropEffect to determine
        // the used effect, but Chrome has not implemented that field correctly. On Windows
        // it always sets it to 'none', while Chrome on Linux sometimes sets it to something
        // else when it's supposed to send 'none' (drag operation aborted).
        scope.$apply(function () {
          var dropEffect = ziState.dropEffect;
          var cb = { copy: 'ziCopied', link: 'ziLinked', move: 'ziMoved', none: 'ziCanceled' };
          $parse(attr[cb[dropEffect]])(scope, { event: event });
          $parse(attr.ziDragend)(scope, { event: event, dropEffect: dropEffect });
        });

        // Clean up
        ziState.isDragging = false;
        ziState.callback = undefined;
        element.removeClass("ziDragging");
        element.removeClass("ziDraggingSource");
        event.stopPropagation();

        // In IE9 it is possible that the timeout from dragstart triggers after the dragend handler.
        $timeout(function () { element.removeClass("ziDraggingSource"); }, 0);
      });

      /**
       * When the element is clicked we invoke the callback function
       * specified with the zi-selected attribute.
       */
      element.on('click', function (event) {
        if (!attr.ziSelected) return;

        event = event.originalEvent || event;
        scope.$apply(function () {
          $parse(attr.ziSelected)(scope, { event: event });
        });

        // Prevent triggering ziSelected in parent elements.
        event.stopPropagation();
      });

      /**
       * Workaround to make element draggable in IE9
       */
      element.on('selectstart', function () {
        if (this.dragDrop) this.dragDrop();
      });
    };
  }]);

  /**
   * Use the zi-list attribute to make your list element a dropzone. Usually you will add a single
   * li element as child with the ng-repeat directive. If you don't do that, we will not be able to
   * position the dropped element correctly. If you want your list to be sortable, also add the
   * zi-draggable directive to your li element(s).
   *
   * Attributes:
   * - zi-list             Required attribute. The value has to be the array in which the data of
   *                        the dropped element should be inserted. The value can be blank if used
   *                        with a custom zi-drop handler that always returns true.
   * - zi-allowed-types    Optional array of allowed item types. When used, only items that had a
   *                        matching zi-type attribute will be dropable. Upper case characters will
   *                        automatically be converted to lower case.
   * - zi-effect-allowed   Optional string expression that limits the drop effects that can be
   *                        performed in the list. See zi-effect-allowed on zi-draggable for more
   *                        details on allowed options. The default value is all.
   * - zi-disable-if       Optional boolean expresssion. When it evaluates to true, no dropping
   *                        into the list is possible. Note that this also disables rearranging
   *                        items inside the list.
   * - zi-horizontal-list  Optional boolean expresssion. When it evaluates to true, the positioning
   *                        algorithm will use the left and right halfs of the list items instead of
   *                        the upper and lower halfs.
   * - zi-external-sources Optional boolean expression. When it evaluates to true, the list accepts
   *                        drops from sources outside of the current browser tab. This allows to
   *                        drag and drop accross different browser tabs. The only major browser
   *                        that does not support this is currently Microsoft Edge.
   *
   * Callbacks:
   * - zi-dragover         Optional expression that is invoked when an element is dragged over the
   *                        list. If the expression is set, but does not return true, the element is
   *                        not allowed to be dropped. The following variables will be available:
   *                        - event: The original dragover event sent by the browser.
   *                        - index: The position in the list at which the element would be dropped.
   *                        - type: The zi-type set on the zi-draggable, or undefined if non was
   *                          set. Will be null for drops from external sources in IE and Edge,
   *                          since we don't know the type in those cases.
   *                        - dropEffect: One of move, copy or link, see zi-effect-allowed.
   *                        - external: Whether the element was dragged from an external source.
   *                        - callback: If zi-callback was set on the source element, this is a
   *                          function reference to the callback. The callback can be invoked with
   *                          custom variables like this: callback({var1: value1, var2: value2}).
   *                          The callback will be executed on the scope of the source element. If
   *                          zi-external-sources was set and external is true, this callback will
   *                          not be available.
   * - zi-drop             Optional expression that is invoked when an element is dropped on the
   *                        list. The same variables as for zi-dragover will be available, with the
   *                        exception that type is always known and therefore never null. There
   *                        will also be an item variable, which is the transferred object. The
   *                        return value determines the further handling of the drop:
   *                        - falsy: The drop will be canceled and the element won't be inserted.
   *                        - true: Signalises that the drop is allowed, but the zi-drop
   *                          callback already took care of inserting the element.
   *                        - otherwise: All other return values will be treated as the object to
   *                          insert into the array. In most cases you want to simply return the
   *                          item parameter, but there are no restrictions on what you can return.
   * - zi-inserted         Optional expression that is invoked after a drop if the element was
   *                        actually inserted into the list. The same local variables as for
   *                        zi-drop will be available. Note that for reorderings inside the same
   *                        list the old element will still be in the list due to the fact that
   *                        zi-moved was not called yet.
   *
   * CSS classes:
   * - ziPlaceholder       When an element is dragged over the list, a new placeholder child
   *                        element will be added. This element is of type li and has the class
   *                        ziPlaceholder set. Alternatively, you can define your own placeholder
   *                        by creating a child element with ziPlaceholder class.
   * - ziDragover          Will be added to the list while an element is dragged over the list.
   */
  ziDragAndDropModule.directive('ziList', ['$parse', function ($parse) {
    return function (scope, element, attr) {
      // While an element is dragged over the list, this placeholder element is inserted
      // at the location where the element would be inserted after dropping.
      var placeholder = getPlaceholderElement();
      placeholder.remove();

      var placeholderNode = placeholder[0];
      var listNode = element[0];
      var listSettings = {};

      /**
       * The dragenter event is fired when a dragged element or text selection enters a valid drop
       * target. According to the spec, we either need to have a dropzone attribute or listen on
       * dragenter events and call preventDefault(). It should be noted though that no browser seems
       * to enforce this behaviour.
       */
      element.on('dragenter', function (event) {
        event = event.originalEvent || event;

        // Calculate list properties, so that we don't have to repeat this on every dragover event.
        var types = attr.ziAllowedTypes && scope.$eval(attr.ziAllowedTypes);
        listSettings = {
          allowedTypes: angular.isArray(types) && types.join('|').toLowerCase().split('|'),
          disabled: attr.ziDisableIf && scope.$eval(attr.ziDisableIf),
          externalSources: attr.ziExternalSources && scope.$eval(attr.ziExternalSources),
          horizontal: attr.ziHorizontalList && scope.$eval(attr.ziHorizontalList)
        };

        var mimeType = getMimeType(event.dataTransfer.types);
        if (!mimeType || !isDropAllowed(getItemType(mimeType))) return true;
        event.preventDefault();
      });

      /**
       * The dragover event is triggered "every few hundred milliseconds" while an element
       * is being dragged over our list, or over an child element.
       */
      element.on('dragover', function (event) {
        event = event.originalEvent || event;

        // Check whether the drop is allowed and determine mime type.
        var mimeType = getMimeType(event.dataTransfer.types);
        var itemType = getItemType(mimeType);
        if (!mimeType || !isDropAllowed(itemType)) return true;

        // Make sure the placeholder is shown, which is especially important if the list is empty.
        if (placeholderNode.parentNode != listNode) {
          element.append(placeholder);
        }

        if (event.target != listNode) {
          // Try to find the node direct directly below the list node.
          var listItemNode = event.target;
          while (listItemNode.parentNode != listNode && listItemNode.parentNode) {
            listItemNode = listItemNode.parentNode;
          }

          if (listItemNode.parentNode == listNode && listItemNode != placeholderNode) {
            // If the mouse pointer is in the upper half of the list item element,
            // we position the placeholder before the list item, otherwise after it.
            var rect = listItemNode.getBoundingClientRect();
            if (listSettings.horizontal) {
              var isFirstHalf = event.clientX < rect.left + rect.width / 2;
            } else {
              var isFirstHalf = event.clientY < rect.top + rect.height / 2;
            }
            listNode.insertBefore(placeholderNode,
              isFirstHalf ? listItemNode : listItemNode.nextSibling);
          }
        }

        // In IE we set a fake effectAllowed in dragstart to get the correct cursor, we therefore
        // ignore the effectAllowed passed in dataTransfer. We must also not access dataTransfer for
        // drops from external sources, as that throws an exception.
        var ignoreDataTransfer = mimeType == MSIE_MIME_TYPE;
        var dropEffect = getDropEffect(event, ignoreDataTransfer);
        if (dropEffect == 'none') return stopDragover();

        // At this point we invoke the callback, which still can disallow the drop.
        // We can't do this earlier because we want to pass the index of the placeholder.
        if (attr.ziDragover && !invokeCallback(attr.ziDragover, event, dropEffect, itemType)) {
          return stopDragover();
        }

        // Set dropEffect to modify the cursor shown by the browser, unless we're in IE, where this
        // is not supported. This must be done after preventDefault in Firefox.
        event.preventDefault();
        if (!ignoreDataTransfer) {
          event.dataTransfer.dropEffect = dropEffect;
        }

        element.addClass("ziDragover");
        event.stopPropagation();
        return false;
      });

      /**
       * When the element is dropped, we use the position of the placeholder element as the
       * position where we insert the transferred data. This assumes that the list has exactly
       * one child element per array element.
       */
      element.on('drop', function (event) {
        event = event.originalEvent || event;

        // Check whether the drop is allowed and determine mime type.
        var mimeType = getMimeType(event.dataTransfer.types);
        var itemType = getItemType(mimeType);
        if (!mimeType || !isDropAllowed(itemType)) return true;

        // The default behavior in Firefox is to interpret the dropped element as URL and
        // forward to it. We want to prevent that even if our drop is aborted.
        event.preventDefault();

        // Unserialize the data that was serialized in dragstart.
        try {
          var data = JSON.parse(event.dataTransfer.getData(mimeType));
        } catch (e) {
          return stopDragover();
        }

        // Drops with invalid types from external sources might not have been filtered out yet.
        if (mimeType == MSIE_MIME_TYPE || mimeType == EDGE_MIME_TYPE) {
          itemType = data.type || undefined;
          data = data.item;
          if (!isDropAllowed(itemType)) return stopDragover();
        }

        // Special handling for internal IE drops, see dragover handler.
        var ignoreDataTransfer = mimeType == MSIE_MIME_TYPE;
        var dropEffect = getDropEffect(event, ignoreDataTransfer);
        if (dropEffect == 'none') return stopDragover();

        // Invoke the callback, which can transform the transferredObject and even abort the drop.
        var index = getPlaceholderIndex();
        if (attr.ziDrop) {
          data = invokeCallback(attr.ziDrop, event, dropEffect, itemType, index, data);
          if (!data) return stopDragover();
        }

        // The drop is definitely going to happen now, store the dropEffect.
        ziState.dropEffect = dropEffect;
        if (!ignoreDataTransfer) {
          event.dataTransfer.dropEffect = dropEffect;
        }

        // Insert the object into the array, unless zi-drop took care of that (returned true).
        if (data !== true) {
          scope.$apply(function () {
            scope.$eval(attr.ziList).splice(index, 0, data);
          });
        }
        invokeCallback(attr.ziInserted, event, dropEffect, itemType, index, data);

        // Clean up
        stopDragover();
        event.stopPropagation();
        return false;
      });

      /**
       * We have to remove the placeholder when the element is no longer dragged over our list. The
       * problem is that the dragleave event is not only fired when the element leaves our list,
       * but also when it leaves a child element. Therefore, we determine whether the mouse cursor
       * is still pointing to an element inside the list or not.
       */
      element.on('dragleave', function (event) {
        event = event.originalEvent || event;

        var newTarget = document.elementFromPoint(event.clientX, event.clientY);
        if (listNode.contains(newTarget) && !event._ziPhShown) {
          // Signalize to potential parent lists that a placeholder is already shown.
          event._ziPhShown = true;
        } else {
          stopDragover();
        }
      });

      /**
       * Given the types array from the DataTransfer object, returns the first valid mime type.
       * A type is valid if it starts with MIME_TYPE, or it equals MSIE_MIME_TYPE or EDGE_MIME_TYPE.
       */
      function getMimeType(types) {
        if (!types) return MSIE_MIME_TYPE; // IE 9 workaround.
        for (var i = 0; i < types.length; i++) {
          if (types[i] == MSIE_MIME_TYPE || types[i] == EDGE_MIME_TYPE ||
            types[i].substr(0, MIME_TYPE.length) == MIME_TYPE) {
            return types[i];
          }
        }
        return null;
      }

      /**
       * Determines the type of the item from the ziState, or from the mime type for items from
       * external sources. Returns undefined if no item type was set and null if the item type could
       * not be determined.
       */
      function getItemType(mimeType) {
        if (ziState.isDragging) return ziState.itemType || undefined;
        if (mimeType == MSIE_MIME_TYPE || mimeType == EDGE_MIME_TYPE) return null;
        return (mimeType && mimeType.substr(MIME_TYPE.length + 1)) || undefined;
      }

      /**
       * Checks various conditions that must be fulfilled for a drop to be allowed, including the
       * zi-allowed-types attribute. If the item Type is unknown (null), the drop will be allowed.
       */
      function isDropAllowed(itemType) {
        if (listSettings.disabled) return false;
        if (!listSettings.externalSources && !ziState.isDragging) return false;
        if (!listSettings.allowedTypes || itemType === null) return true;
        return itemType && listSettings.allowedTypes.indexOf(itemType) != -1;
      }

      /**
       * Determines which drop effect to use for the given event. In Internet Explorer we have to
       * ignore the effectAllowed field on dataTransfer, since we set a fake value in dragstart.
       * In those cases we rely on ziState to filter effects. Read the design doc for more details:
       * https://github.com/marceljuenemann/angular-drag-and-drop-lists/wiki/Data-Transfer-Design
       */
      function getDropEffect(event, ignoreDataTransfer) {
        var effects = ALL_EFFECTS;
        if (!ignoreDataTransfer) {
          effects = filterEffects(effects, event.dataTransfer.effectAllowed);
        }
        if (ziState.isDragging) {
          effects = filterEffects(effects, ziState.effectAllowed);
        }
        if (attr.ziEffectAllowed) {
          effects = filterEffects(effects, attr.ziEffectAllowed);
        }
        // MacOS automatically filters dataTransfer.effectAllowed depending on the modifier keys,
        // therefore the following modifier keys will only affect other operating systems.
        if (!effects.length) {
          return 'none';
        } else if (event.ctrlKey && effects.indexOf('copy') != -1) {
          return 'copy';
        } else if (event.altKey && effects.indexOf('link') != -1) {
          return 'link';
        } else {
          return effects[0];
        }
      }

      /**
       * Small helper function that cleans up if we aborted a drop.
       */
      function stopDragover() {
        placeholder.remove();
        element.removeClass("ziDragover");
        return true;
      }

      /**
       * Invokes a callback with some interesting parameters and returns the callbacks return value.
       */
      function invokeCallback(expression, event, dropEffect, itemType, index, item) {
        return $parse(expression)(scope, {
          callback: ziState.callback,
          dropEffect: dropEffect,
          event: event,
          external: !ziState.isDragging,
          index: index !== undefined ? index : getPlaceholderIndex(),
          item: item || undefined,
          type: itemType
        });
      }

      /**
       * We use the position of the placeholder node to determine at which position of the array the
       * object needs to be inserted
       */
      function getPlaceholderIndex() {
        return Array.prototype.indexOf.call(listNode.children, placeholderNode);
      }

      /**
       * Tries to find a child element that has the ziPlaceholder class set. If none was found, a
       * new li element is created.
       */
      function getPlaceholderElement() {
        var placeholder;
        angular.forEach(element.children(), function (childNode) {
          var child = angular.element(childNode);
          if (child.hasClass('ziPlaceholder')) {
            placeholder = child;
          }
        });
        return placeholder || angular.element("<li class='ziPlaceholder'></li>");
      }
    };
  }]);

  /**
   * Use the zi-nodrag attribute inside of zi-draggable elements to prevent them from starting
   * drag operations. This is especially useful if you want to use input elements inside of
   * zi-draggable elements or create specific handle elements. Note: This directive does not work
   * in Internet Explorer 9.
   */
  ziDragAndDropModule.directive('ziNodrag', function () {
    return function (scope, element, attr) {
      // Set as draggable so that we can cancel the events explicitly
      element.attr("draggable", "true");

      /**
       * Since the element is draggable, the browser's default operation is to drag it on dragstart.
       * We will prevent that and also stop the event from bubbling up.
       */
      element.on('dragstart', function (event) {
        event = event.originalEvent || event;

        if (!event._ziHandle) {
          // If a child element already reacted to dragstart and set a dataTransfer object, we will
          // allow that. For example, this is the case for user selections inside of input elements.
          if (!(event.dataTransfer.types && event.dataTransfer.types.length)) {
            event.preventDefault();
          }
          event.stopPropagation();
        }
      });

      /**
       * Stop propagation of dragend events, otherwise zi-moved might be triggered and the element
       * would be removed.
       */
      element.on('dragend', function (event) {
        event = event.originalEvent || event;
        if (!event._ziHandle) {
          event.stopPropagation();
        }
      });
    };
  });

  /**
   * Use the zi-handle directive within a zi-nodrag element in order to allow dragging with that
   * element after all. Therefore, by combining zi-nodrag and zi-handle you can allow
   * zi-draggable elements to only be dragged via specific "handle" elements. Note that Internet
   * Explorer will show the handle element as drag image instead of the zi-draggable element. You
   * can work around this by styling the handle element differently when it is being dragged. Use
   * the CSS selector .ziDragging:not(.ziDraggingSource) [zi-handle] for that.
   */
  ziDragAndDropModule.directive('ziHandle', function () {
    return function (scope, element, attr) {
      element.attr("draggable", "true");

      element.on('dragstart dragend', function (event) {
        event = event.originalEvent || event;
        event._ziHandle = true;
      });
    };
  });

  /**
   * Filters an array of drop effects using a HTML5 effectAllowed string.
   */
  function filterEffects(effects, effectAllowed) {
    if (effectAllowed == 'all') return effects;
    return effects.filter(function (effect) {
      return effectAllowed.toLowerCase().indexOf(effect) != -1;
    });
  }

  /**
   * For some features we need to maintain global state. This is done here, with these fields:
   * - callback: A callback function set at dragstart that is passed to internal dropzone handlers.
   * - dropEffect: Set in dragstart to "none" and to the actual value in the drop handler. We don't
   *   rely on the dropEffect passed by the browser, since there are various bugs in Chrome and
   *   Safari, and Internet Explorer defaults to copy if effectAllowed is copyMove.
   * - effectAllowed: Set in dragstart based on zi-effect-allowed. This is needed for IE because
   *   setting effectAllowed on dataTransfer might result in an undesired cursor.
   * - isDragging: True between dragstart and dragend. Falsy for drops from external sources.
   * - itemType: The item type of the dragged element set via zi-type. This is needed because IE
   *   and Edge don't support custom mime types that we can use to transfer this information.
   */
  var ziState = {};

})(angular.module('ziDragAndDropModule', []));
