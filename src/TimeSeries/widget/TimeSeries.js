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
    "dojo/text!TimeSeries/widget/template/TimeSeries.html",
    "TimeSeries/lib/d3-3.5.17",
    "TimeSeries/lib/nv.d3.min-1.8.5"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, dojoProp, dojoGeometry, dojoClass, dojoStyle, dojoConstruct, dojoArray, dojoLang, dojoText, dojoHtml, dojoEvent, _jQuery, widgetTemplate) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    // Declare widget's prototype.
    return declare("TimeSeries.widget.TimeSeries", [ _WidgetBase, _TemplatedMixin ], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // DOM elements
        svgNode: null,

        // Parameters configured in the Modeler.
        graphSourceURL: "",
        isRendered: false,

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
            this._updateRendering();
        },

        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function (obj, callback) {
            logger.debug(this.id + ".update");

            this._contextObj = obj;
            this._resetSubscriptions();
            this._updateRendering(callback); // We're passing the callback to updateRendering to be called after DOM-manipulation
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

        // Rerender the interface.
        _updateRendering: function (callback) {
            logger.debug(this.id + "._updateRendering");

            if (this._contextObj !== null) {
                dojoStyle.set(this.domNode, "display", "block");

                this._renderGraph();

            } else {
                dojoStyle.set(this.domNode, "display", "none");
            }

            // The callback, coming from update, needs to be executed, to let the page know it finished rendering
            mendix.lang.nullExec(callback);
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
          if (this.isRendered) {
            return;
          }
          this.isRendered = true;
          var widget = this;
          this._contextObj.fetch(this.graphSourceURL, function(url) {
              d3.json(url, function(data) {
                widget._marshallSources(data);
              });
          });
        },

        _getYAxisFormat: function (dataFormat) {
          if (dataFormat == "bytes") {
            return this.convertBytesToString;
          } else if (dataFormat == "percentage") {
            return d3.format(".1f");
          } else {
            return d3.format(".4s");
          }
        },

        _getXAxisFormat: function (period) {
          switch (period) {
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
        _getYAxisLabel: function (label) {
          if (label === undefined) {
            return "";
          }
          return label;
        },


        _marshallSources: function (graphData) {
          var svgNode = this.svgNode;
          var data = [];
          var _widget = this;
          graphData.metrics.map(function(metric){
            var values = [];
            var i;
            for (i = 0; i < graphData.timestamps.length; i++) {
              values.push([graphData.timestamps[i], metric.values[i]]);
            }
            data.push({
              color: metric.color,
              key: metric.caption,
              values: values,
            });
          });

          nv.addGraph(function() {
            var chart;
            var maxValCandidates = [];
            if (graphData.render == "line") {
              chart = nv.models.lineChart();
              for (var i = 0; i < data.length; i++) {
                maxValCandidates.push(Math.max.apply(null, data[i].values));
              }
              if (graphData.datatype == "percentage") {
                chart.lines.forceY([0.0, 100.0]);
              } else {
                chart.lines.forceY([0.0, Math.max.apply(null, maxValCandidates)]);
              }
            } else {
              chart = nv.models.stackedAreaChart();
              chart = chart.showControls(false);
            }
            chart = chart.margin({right: 100})
              .x(function(d) { return d[0] })
              .y(function(d) { return d[1] })
              .useInteractiveGuideline(true)
              .rightAlignYAxis(true)
              .clipEdge(true);

            //Format x-axis labels with custom function.
            chart.xAxis
              .tickFormat(function(d) {
                var format = _widget._getXAxisFormat(graphData.period);
                return d3.time.format(format)(new Date(d));
              });

            chart.yAxis
              .tickFormat(_widget._getYAxisFormat(graphData.datatype));
            chart.yAxis
              .axisLabel(_widget._getYAxisLabel(graphData.label));

            d3.select(svgNode)
              .datum(data)
              .call(chart);

            nv.utils.windowResize(chart.update);

            return chart;
          });
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
