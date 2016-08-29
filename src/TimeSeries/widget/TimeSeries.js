/*global logger*/
/*
    TimeSeries
    ========================

    @file      : TimeSeries.js
    @version   : {{version}}
    @author    : {{author}}
    @date      : {{date}}
    @copyright : {{copyright}}
    @license   : {{license}}

    Documentation
    ========================
    Describe your widget here.
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",

    "mxui/dom",
    "dojo/dom",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",
    "dojo/_base/event",

    "TimeSeries/lib/jquery-1.11.2",
    "TimeSeries/lib/d3-queue-3.0.3",
    "dojo/text!TimeSeries/widget/template/TimeSeries.html",
    "TimeSeries/lib/d3-3.5.17",
    "TimeSeries/lib/nv.d3.min-1.8.1"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoEvent, _jQuery, _Queue, widgetTemplate) {
    "use strict";

    var $ = _jQuery.noConflict(true);
    window.d3.queue = _Queue.queue;

    // Declare widget's prototype.
    return declare("TimeSeries.widget.TimeSeries", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        svgNode: null,

        // Parameters configured in the Modeler.
        graphType: "",
        graphLabel: "",
        dataPeriod: "",
        dataFormat: "",
        graphSourceURL: "",
        graphSourceCaption: "",
        graphSourceColor: "",

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _alertDiv: null,
        _readOnly: false,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            logger.debug(this.id + ".constructor");
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            logger.debug(this.id + ".postCreate");

            if (this.readOnly || this.get("disabled") || this.readonly) {
              this._readOnly = true;
            }

            this._updateRendering();
//            this._setupEvents();
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            console.log(this.graphSourceURL);
            //console.log(obj.getReferences("MyFirstModule.Graph_GraphSource"));
            this._resetSubscriptions();
            this._updateRendering(callback); // We're passing the callback to updateRendering to be called after DOM-manipulation
        },

        // mxui.widget._WidgetBase.enable is called when the widget should enable editing. Implement to enable editing if widget is input widget.
        enable: function () {
          logger.debug(this.id + ".enable");
        },

        // mxui.widget._WidgetBase.enable is called when the widget should disable editing. Implement to disable editing if widget is input widget.
        disable: function () {
          logger.debug(this.id + ".disable");
        },

        // mxui.widget._WidgetBase.resize is called when the page's layout is recalculated. Implement to do sizing calculations. Prefer using CSS instead.
        resize: function (box) {
          logger.debug(this.id + ".resize");
        },

        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function () {
          logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },

        // We want to stop events on a mobile device
        _stopBubblingEventOnMobile: function (e) {
            logger.debug(this.id + "._stopBubblingEventOnMobile");
            if (typeof document.ontouchstart !== "undefined") {
                dojoEvent.stop(e);
            }
        },

        // Attach events to HTML dom elements
        _setupEvents: function () {
            logger.debug(this.id + "._setupEvents");
            /*
            this.connect(this.colorSelectNode, "change", function (e) {
                // Function from mendix object to set an attribute.
                this._contextObj.set(this.backgroundColor, this.colorSelectNode.value);
            });
            */

            /*
            this.connect(this.infoTextNode, "click", function (e) {
                // Only on mobile stop event bubbling!
                this._stopBubblingEventOnMobile(e);

                // If a microflow has been set execute the microflow on a click.
                if (this.mfToExecute !== "") {
                    mx.data.action({
                        params: {
                            applyto: "selection",
                            actionname: this.mfToExecute,
                            guids: [ this._contextObj.getGuid() ]
                        },
                        store: {
                            caller: this.mxform
                        },
                        callback: function (obj) {
                            //TODO what to do when all is ok!
                        },
                        error: dojoLang.hitch(this, function (error) {
                            logger.error(this.id + ": An error occurred while executing microflow: " + error.description);
                        })
                    }, this);
                }
            });
            */
        },

        // Rerender the interface.
        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");
            /*
            this.colorSelectNode.disabled = this._readOnly;
            this.colorInputNode.disabled = this._readOnly;
            */

            if (this._contextObj !== null) {
                dojoStyle.set(this.domNode, "display", "block");

                //var colorValue = this._contextObj.get(this.backgroundColor);

                //this.colorInputNode.value = colorValue;
                //this.colorSelectNode.value = colorValue;

                //dojoHtml.set(this.infoTextNode, this.messageString);
                this._renderGraph();

                //dojoStyle.set(this.infoTextNode, "background-color", colorValue);
            } else {
                dojoStyle.set(this.domNode, "display", "none");
            }

            // Important to clear all validations!
            this._clearValidations();

            // The callback, coming from update, needs to be executed, to let the page know it finished rendering
            mendix.lang.nullExec(callback);
        },

        // Handle validations.
        _handleValidation: function (validations) {
            logger.debug(this.id + "._handleValidation");
            this._clearValidations();

            var validation = validations[0],
                message = validation.getReasonByAttribute(this.backgroundColor);

            if (this._readOnly) {
                validation.removeAttribute(this.backgroundColor);
            } else if (message) {
                this._addValidation(message);
                validation.removeAttribute(this.backgroundColor);
            }
        },

        // Clear validations.
        _clearValidations: function () {
            logger.debug(this.id + "._clearValidations");
            dojoConstruct.destroy(this._alertDiv);
            this._alertDiv = null;
        },

        // Show an error message.
        _showError: function (message) {
            logger.debug(this.id + "._showError");
            if (this._alertDiv !== null) {
                dojoHtml.set(this._alertDiv, message);
                return true;
            }
            this._alertDiv = dojoConstruct.create("div", {
                "class": "alert alert-danger",
                "innerHTML": message
            });
            dojoConstruct.place(this._alertDiv, this.domNode);
        },

        // Add a validation.
        _addValidation: function (message) {
            logger.debug(this.id + "._addValidation");
            this._showError(message);
        },

        _unsubscribe: function () {
          if (this._handles) {
              dojoArray.forEach(this._handles, function (handle) {
                  mx.data.unsubscribe(handle);
              });
              this._handles = [];
          }
        },

        // Reset subscriptions.
        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            // Release handles on previous object, if any.
            this._unsubscribe();

            // When a mendix object exists create subscribtions.
            if (this._contextObj) {
                var objectHandle = mx.data.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: dojoLang.hitch(this, function (guid) {
                        this._updateRendering();
                    })
                });

                var attrHandle = mx.data.subscribe({
                    guid: this._contextObj.getGuid(),
                    attr: this.backgroundColor,
                    callback: dojoLang.hitch(this, function (guid, attr, attrValue) {
                        this._updateRendering();
                    })
                });

                var validationHandle = mx.data.subscribe({
                    guid: this._contextObj.getGuid(),
                    val: true,
                    callback: dojoLang.hitch(this, this._handleValidation)
                });

                this._handles = [ objectHandle, attrHandle, validationHandle ];
            }
        },

        // Helper/Internal functions
        _renderGraph: function () {
          this._fetchGraphSources(this._processGraphSources);
        },
        _getYAxisFormat: function () {
          if (this.dataFormat == "bytes") {
            return this.convertBytesToString;
          } else {
            return d3.format(",.1s");
          }
        },
        _getXAxisFormat: function () {
          switch (this.dataPeriod) {
            case "hour":
            case "day":
              return "%H:%M";
            case "week":
              return "%d %b";
            case "month":
              return "%d %b";
            case "year":
              return "%d %b %Y";
            default:
              return "%x %X";
          }
        },
        _getYAxisLabel: function () {
          if (this.graphLabel == undefined) {
            return "";
          }
          return this.graphLabel;
        },
        _processGraphSources: function (objs) {
          var graphSourceURL = this._parseAttributeName(this.graphSourceURL);
          var graphSourceCaption = this._parseAttributeName(this.graphSourceCaption);

          var sources = objs.map(function(graphSource){
            return {
              url: graphSource.get(graphSourceURL),
              caption: graphSource.get(graphSourceCaption),
            };
          });
          this._renderGraphInternal(sources);
        },

        _marshallSources: function (captions, results) {
          var svgNode = this.svgNode;
          var data = [];
          var _widget = this;
          var i;
          for (i = 0; i < captions.length; i++) {
            data.push({
              key: captions[i],
              values: results[i].map(function(item){
                return [item.timestamp, item.value];
              })
            });
          }

          nv.addGraph(function() {
            var chart;
            if (_widget.graphType == "line") {
              chart = nv.models.lineChart();
            } else {
              chart = nv.models.stackedAreaChart();
              chart = chart.showControls(false);
            }
            chart = chart.margin({right: 100})
              .x(function(d) { return d[0] })   //We can modify the data accessor functions...
              .y(function(d) { return d[1] })   //...in case your data is formatted differently.
              .useInteractiveGuideline(true)    //Tooltips which show all data points. Very nice!
              .rightAlignYAxis(true)      //Let's move the y-axis to the right side.
              .clipEdge(true);

            //Format x-axis labels with custom function.
            chart.xAxis
              .tickFormat(function(d) {
                var format = _widget._getXAxisFormat();
                return d3.time.format(format)(new Date(d));
              });

            chart.yAxis
              .tickFormat(_widget._getYAxisFormat());
            chart.yAxis
              .axisLabel(_widget._getYAxisLabel());

            d3.select(svgNode)
              .datum(data)
              .call(chart);

            nv.utils.windowResize(chart.update);

            return chart;
          });
        },

        _renderGraphInternal: function (sources) {
          var _widget = this;
          var captions = sources.map(function(item){
            return item.caption;
          });
          var queue = d3.queue();
          sources.map(function(item){
            queue.defer(d3.json, item.url);
          });
          queue.awaitAll(function(error, results){
            console.log(error);
            if (!error) {
              _widget._marshallSources(captions, results);
            }
          });
        },

        _fetchGraphSources: function (callback) {
          var referenceName = this._parseReferenceName(this.graphSourceURL);
          var graphSourceGuids = this._contextObj.getReferences(referenceName);
          mx.data.get({
            guids: graphSourceGuids,
            callback: callback
          }, this);
        },
        _parseReferenceName: function (attributePath) {
          return attributePath.split("/")[0];
        },
        _parseEntityName: function (attributePath) {
          return attributePath.split("/")[1];
        },
        _parseAttributeName: function (attributePath) {
          return attributePath.split("/")[2];
        },
        convertBytesToString: function (bytes) {
          var fmt = d3.format('.0f');
          if (bytes < 1024) {
            return fmt(bytes) + 'B';
          } else if (bytes < 1024 * 1024) {
            return fmt(bytes / 1024) + 'KB';
          } else if (bytes < 1024 * 1024 * 1024) {
            return fmt(bytes / 1024 / 1024) + 'MB';
          } else {
            return fmt(bytes / 1024 / 1024 / 1024) + 'GB';
          }
        }
    });
});

require(["TimeSeries/widget/TimeSeries"]);