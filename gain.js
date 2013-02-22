var GAIN = (function(window, jQuery, console){
  "use strict";
  var self = {};
  
  self.ui = {
    init : function init(){
        jQuery('body').on('click', '.toggle', function(event) {
          var button = jQuery(event.target),
              parent = button.parents('[data-complete]').first();
          if(parent.hasClass('shut')){
            button.text('‒');
            parent.removeClass('shut');
          }
          else {
            button.text('+');
            parent.addClass('shut');
          }
        });   
    },

    shut : function shut(id){
      var $el = jQuery('#'+id),
          isSection = $el.hasClass('section'),
          isQuestion = $el.hasClass('question'),
          firstChild = $el.children(':first'),
          firstChildIsQuestion = firstChild.hasClass('question');

      /* TODO: consider moving the conditional logic to the 'surveyView.stepComplete' event handler and using shut() only to render the shut, not to decide when to do so. */
      // Leave open under these conditions
      if (
        (isSection &&
          firstChildIsQuestion) ||

        (isQuestion && (
          $el.hasClass('block') ||
          firstChild.hasClass('items') ||
          $el.hasClass('send-to-server')
        ))
      ){
        return;
      }

      // Shut
      $el.addClass('shut')
         .append('<button class="toggle">+</button>');
    }
  }
  
  self.backup = {
    button : null,
    send : function send(arg){
      var data = this.getData();
      this.button = jQuery('.send-to-server input[type="submit"]');
          
      this.button.val('Sending...');
      this.button.attr('disabled', 'disabled');
      
      if(jQuery.isEmptyObject(data)){
        self.backup.fail(null, { message : 'no data' });
      }else{
        this.syncData(data, {
          success: function(obj) {
            self.backup.success(obj)
          },
          error: function(obj, error) {
            self.backup.fail(obj, error)
          }
        });
      }
    },
    success : function success(obj){
      this.button.val('Sent');
      this.updateCache(obj.id);
    },
    fail : function fail(obj, error){
      this.button.val('...Failed');
      console.log('Send to Parse.com failed:')
      for(var propertyName in error) {
        console.log(propertyName +', '+error[propertyName])
      }
    },
    getData: function getData(){
      var data = {};
      jQuery.each(decide.survey.responses, function(key, val){
        // '0.1.1' is not a valid field name
        data[decide.surveyView.formatId(key, 'q')] = val; 
      })
      // the 'parse.com' id from the cache
      data.id = decide.cacheManager.getThirdPartyId(decide.survey.surveyId) || null; 
      return data;
    },
    updateCache : function updateCache(id){
      // Add the returned id from parse to the cache
      decide.cacheManager.setThirdPartyId(decide.survey.surveyId, id)
    },
    /*
      Synchronises the data with the Parse server.

      Expects upto two parameters:
        data: a json object that has to be stored on the server.
          data.id: existing id if any for the object - will cause an update
          instead. If an id is present, it will cause an update - else create.

        callbacks: an object that can have a 'success' and an 'error' function.
          the saved object is the first parameter in both these functions.
          This parameter is NOT required though you should give one.
          An example:
              {
                success: function(myObject) {
                  // myObject.id is the id of this item
                  console.log('All saved!');
                },
                error: function(myObject, error) {
                  console.log('Something bad happened!');
                }
              }
    */
    syncData : function syncData(data, callbacks) {
      var parseClassName = 'AgricultureSurvey',
          DataObject, query, myObject, id;
          
      // Check the Parse wrapper is available
      if (!Parse){
        return false;
      }
      Parse.initialize('LMMv1zyVhIVA2TpMBPGJCF7rcfgKj2FNGzgPNsLw',
                       'UbgbvSxlYgl1BjMZpQ3FGvc8J4kohG7b2R3ahHf5');

      // Set to HTTP endpoint for IE, since IE errors on POSTing from
      // an HTTP page to an HTTPS endpoint
      // https://www.parse.com/questions/error-with-ms-ie9
      /* TODO: check Ajax from HTTP -> HTTPS in latest IE */
      if (jQuery.browser.msie){
        Parse.serverURL = 'http://api.parse.com';
      }
      
      // Check we have valid data object
      if (Object.prototype.toString.call(data) !== '[object Object]') {
        return false;
      }

      DataObject = Parse.Object.extend(parseClassName);
      query = new Parse.Query(DataObject);
      callbacks = callbacks || { success: function() {}, error: function(){} };
      id = id || data.id || null;

      if (id) {
        // don't save the ID.
        delete(data.id);

        query.get(id, {
          success: function(response) {
            response.save(data, callbacks);
          },
          error: function(response, error) {
            myObject = new DataObject();
            myObject.save(data, callbacks);
          }
        });
      }
      else {
        myObject = new DataObject();
        myObject.save(data, callbacks);
      }
    },
    updateData : function updateData(id, data) {
      var newData = data;

      newData.id = id;

      // Save the data again... provide an id so that we know to update an
      // existing key.
      this.syncData(newData, {});
    }
  }

  
  self.init = function(){

    self.ui.init();

  
    decide.surveyView.events.on('surveyView.stepComplete', function(event, arg){
      self.ui.shut(arg.id);
    });  
    
    decide.survey.events.on('survey.end', function(event, arg){
      self.backup.send(arg);
    });
    
  }
  
  return self;
  
}(this, this.jQuery, this.console || {log:function(){}}));

  