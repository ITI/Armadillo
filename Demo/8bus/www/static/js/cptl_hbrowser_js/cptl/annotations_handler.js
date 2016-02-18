/*
* copyright (c) 2016, Gabriel A. Weaver
* This one's for CyPSA all y'all
*/
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.AnnotationsHandler = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

module.exports = (function () {
  'use strict';

    function AnnotationsHandler(config) {
	config = config || {};
	this.config = config;
    }

    //-- Set the websocket URL
    AnnotationsHandler.prototype.set_socket_url = function(socket_url) {
	this.config.socket_url = socket_url;
    };


    AnnotationsHandler.prototype.load_annotations_into_localstorage = function(project_name, entry_vertex, storage_key, update_function) {
	var web_socket = new WebSocket( this.config.socket_url );
	var request_params = project_name + "," + entry_vertex;
	var annotations_str;
	var annotations_data;
	
	web_socket.onopen = function(e) {
	    web_socket.send(request_params);
	}

	// 'this' will get overwritten when we enter the web socket callback
	var self = this;
	web_socket.onmessage = function(e) {

	    /* We have to convert access paths data into 
               CSV data to preserve the interface: 
	       
	       The expected data format for annotations is 
	       documented within the d3.csv.parse method.
	    */
	    var access_paths_data = JSON.parse( e.data );
	    var annotations_csv_data = [];

	    for (var i in access_paths_data) {
		var access_path_row = access_paths_data[i];
		var row_annotations = {};
		row_annotations["cypsa:node_type"] = access_path_row[0];
		row_annotations["enet:hasIPAddressValue"] = access_path_row[1];
		row_annotations["cypsa:performance_idx"] = access_path_row[2];
		row_annotations["cypsa:security_idx"] = access_path_row[3];
		row_annotations["cypsa:cyber_cost"] = access_path_row[4];

		annotations_csv_data.push(row_annotations);
	    }

	    var annotations_csv_str = JSON.stringify( annotations_csv_data );
	    localStorage.setItem( storage_key, annotations_csv_str );
	    update_function( annotations_csv_data );
	}

    };


    AnnotationsHandler.prototype.tree_visitor = function ( tree_join_key, root, vertex_join_key, vertices ) {
	this.tree_visitor_helper( tree_join_key, root, vertex_join_key, vertices);
    };

    AnnotationsHandler.prototype.tree_visitor_helper = function ( tree_join_key, node, vertex_join_key, vertices ) {
	if ( tree_join_key in node ) {
	    var join_key_value = node[tree_join_key];
	    var vertex = vertices.filter( function(d) { return ( d[vertex_join_key] == join_key_value ); } );
	    if ( vertex.length > 0 ) {
		// if the appropriate property value is in the list of vertices, annotate the tree node
		vertex = vertex[0];
		for ( var attrname in vertex ) {
		    if ( attrname != "name" ) {
			node[attrname] = vertex[attrname];
		    } // don't overwrite the node 'name' with the vertex 'name'
		} // annotate
	    } // if we found a vertex
	}

	// -- else continue to look to annotate
	if ( "children" in node ) {
	    for (var i=0; i < node.children.length; i++) {
		var child = node.children[i];
		this.tree_visitor_helper( tree_join_key, child, vertex_join_key, vertices );
	    }
	} // if the node even has children
	return;
    };

    /*
     * annotate json_tree_data in place
     */
    AnnotationsHandler.prototype.annotate_tree = function( json_tree_data, json_graph_data, tree_join_key, vertex_join_key) {
	var join_key = "name";
	var root = json_tree_data;
	var vertices = json_graph_data["nodes"];
	this.tree_visitor( tree_join_key, root, vertex_join_key, vertices );
    };
    
    /*
     * annotate json_graph_data in place
     */
    AnnotationsHandler.prototype.annotate_graph = function( json_graph_data, annotations_csv_data, join_key) {

	// Create a dictionary from the join key to the appropriate annotation
	var value_2_annotation_idx = {};
	for ( var i in annotations_csv_data ) {
	    var row_annotations = annotations_csv_data[i];
	    var join_key_value = row_annotations[ join_key ];
	    if ( null != join_key_value ) {
		value_2_annotation_idx[ join_key_value ] = i;
	    } else {
		console.log("Join key not found in annotation!");
	    }
	}
	
	// Annotate only those nodes with the join key
	var nodes = json_graph_data["nodes"];	
	var nodes_with_key = nodes.filter( function(n) { return (join_key in n) });
	for ( var i=0; i < nodes_with_key.length; i++ ) {
	    var node = nodes_with_key[i];
	    var join_key_value = node[ join_key ];

	    var annotation_idx = value_2_annotation_idx[ join_key_value ];
	    if ( annotation_idx != null ) {
		var node_annotations = annotations_csv_data[ annotation_idx ];
		for (var key in node_annotations) {
		    node[key] = node_annotations[ key ];
		}
	    } // else, not all nodes will be annotated
	}
    };
    
    AnnotationsHandler.prototype.update_annotations_table = function ( annotations_csv_data, annotations_join_key ) {
	var asset_info_table = document.getElementById("annotations-table");
	var tbody = asset_info_table.getElementsByTagName("tbody")[0];

	for ( var i in annotations_csv_data ) {
	    var annotation_row = annotations_csv_data[i];

	    var tr = document.createElement("tr");
	    tr.setAttribute("id", annotation_row[annotations_join_key]);
	    tr.setAttribute("onclick", "toggle_asset(this, selected_asset_names, deselected_asset_names, ip_2_name)");

            for ( var column_name in annotation_row ) {
              var td = document.createElement("td");
              var data_value = annotation_row[ column_name ];
              td.appendChild( document.createTextNode( data_value ) );
              tr.appendChild(td);
            }
            tbody.appendChild(tr);
	}
    };

    
    return AnnotationsHandler;
})();

},{}]},{},[1])(1)
});
