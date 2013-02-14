// Decide dependancies

var tim   = function(){var e=/{{\s*([a-z0-9_][\\.a-z0-9_]*)\s*}}/gi;return function(f,g){return f.replace(e,function(h,i){for(var c=i.split("."),d=c.length,b=g,a=0;a<d;a++){b=b[c[a]];if(b===void 0)throw"tim: '"+c[a]+"' not found in "+h;if(a===d-1)return b}})}}(),
    Cache = function(e){"use strict";function i(e){this.prefix=e?e+".":""}var t=e.JSON,n;try{n=e.localStorage}catch(r){}if(!n){return function(){var e=function(){},t=e.prototype;t.set=t.remove=function(){return this};t.get=t.wrapper=t.time=function(){};t.localStorage=e.localStorage=false;return e}()}i.localStorage=true;i.prototype={localStorage:true,set:function(e,r,i){var s={v:r,t:(new Date).getTime()};n[this.prefix+e]=t.stringify(s);return i!==true?this:s},wrapper:function(e){var r=n[this.prefix+e];return r?t.parse(r):r},get:function(e){var t=this.wrapper(e);return t?t.v:t},time:function(e){var t=this.wrapper(e);return t?t.t:t},remove:function(e){n.removeItem(this.prefix+e);return this}};return i}(window);

// Decide module

var Decide = (function (window, document) {
  'use strict';

  // ---------------------------------------------------
  // CONTROLLER - Decide
  // ---------------------------------------------------

  // Exposed to global scope, usage:
  //
  // var decide = new Decide('#wrapper', 'data.json', 'templates.html');
  //
  // or
  //
  // var decide = new Decide('#wrapper', [...], 
  //                         '<script type="text/template"> ... <script></script>',
  //                         { test : true });
  //
  // ensure to include options.test = true to pass in template html directly
  // 
  // options
  //   test     - Boolean   - in test mode or not
  //   idPrefix - string    - text to prefix html ids with 
  //                          in the case they begin with a number
  //   startId  - string    - id of question to use as the name for this survey 
  //   callback - function  - called after templates and data are loaded, on init

  function Decide (container, steps, templates, options) {
    var decide                 = this;
    this.events                = jQuery({});
    this.steps                 = null;
    this.firstStep             = null;
    this.options               = options                    || {};
    this.options.idPrefix      = this.options.idPrefix      || 'uid-';
    this.options.selectDefault = this.options.selectDefault || 'Select';
    this.options.buttonText    = this.options.buttonText    || 'Next >';
    this.options.warning       = this.options.warning       || 'Please choose an option';

    this.getTemplates(templates, function (error, templates) {
      decide.steps = steps || Decide.STEP_DATA;
      if (!error) {
        decide.firstStep = decide.getFirstStep();
        decide.setup(decide.steps, container, templates);
        decide.init();
      }
    });

    if (this.options.debug) {
      this.displayDebug();
    }
  }

  Decide.prototype = {

    // Sets up events between the survey and the survey
    // view with decide acting as proxy for them

    setup: function (steps, container, templates) {
      var decide = this;

      steps = this.getFlattenedSteps(steps);

      this.cacheManager = new CacheManager();
      this.surveyView   = new SurveyView(this.events, container, templates, this.options);
      this.survey       = new Survey(steps, this.cacheManager, this.firstStep);

      // Listen for view events

      this.surveyView.events.on('surveyView.answer', function (event, arg) {
        decide.survey.answer(arg);
      });

      this.surveyView.events.on('surveyView.startNewSurvey', function (event, arg) {
        decide.survey.startNewSurvey(arg);
      });

      this.surveyView.events.on('surveyView.blankSurvey', function (event, arg) {
        decide.survey.clearState();
      });

      this.surveyView.events.on('surveyView.deleteSurvey', function (event, arg) {
        decide.survey.remove(arg.surveyId);
      });

      this.surveyView.events.on('surveyView.save', function () {
        decide.survey.save();
      });

      this.surveyView.events.on('surveyView.changeSurvey', function (event, arg) {
        decide.survey.change(arg.surveyId);
      });

      // Listen for model events

      this.survey.events.on('survey.answer', function (event, arg) {
        decide.events.trigger('decide.answer', arg);
      });
      
      this.survey.events.on('survey.complete', function (event, arg) {
        decide.events.trigger('decide.complete', arg);
      });

      this.survey.events.on('survey.edit', function (event, arg) {
        decide.events.trigger('decide.edit', arg);
      });

      this.survey.events.on('survey.new', function (event, arg) {
        decide.events.trigger('decide.newSurvey', arg);
      });

      this.survey.events.on('survey.change', function (event, arg) {
        decide.events.trigger('decide.change', arg);
      });

      this.survey.events.on('survey.save', function (event, arg) {
        decide.events.trigger('decide.save', arg);
      });

      this.survey.events.on('survey.end', function (event, arg) {
        decide.events.trigger('decide.end', arg);
      });

      this.survey.events.on('survey.delete', function (event, arg) {
        decide.events.trigger('decide.delete', arg);
      });

      // Listen for cache manager events

      this.survey.events.on('cacheManager.cacheUnavailable', function (event, arg) {
        decide.events.trigger('decide.cacheUnavailable', arg);
      });
    },

    // Calls back with a template object and possible error
    // as first callback argument

    getTemplates: function getTemplates(templates, callback) {
      var decide = this;
      if (decide.options.test) { // pass data in directly
        callback(null, decide.constructTemplatesObject(templates));
      } else { 
        jQuery.get(templates, function(data) {
          callback(null, decide.constructTemplatesObject(data));
        })
        .error(function () {
          callback(new Error('Could not get template HTML'));
        });
      }
    },
    
    // Gets an object from the templates passed in and adds to that array
    // any templates found in the page
    constructTemplatesObject : function constructTemplatesObject(data){
      var decide = this,
          templatesArr = decide.createTemplatesObject(data),
          pageArr = decide.createTemplatesObject(document.body.innerHTML);
      return templatesArr.concat(pageArr);
    },
    
    // converts an html sting containing script elements into 
    // an array with an object for each template on the page.
    // each value is a string representation of the template html
    createTemplatesObject : function createTemplatesObject(data){
      var templatesArr = [],
          templateElements = jQuery(data).filter('script[type="text/template"][id]')
            .each(function(i, script){
              var item = {};
              script = jQuery(script);
              item.type = script.attr("id");
              item.template = jQuery.trim(script.html());
              templatesArr.push(item);
          });
      return templatesArr;
    },

    // Returns the first step.
    // The first step is the first step in the array order 
    // which is not a detached step

    getFirstStep: function () {
      for (var i = 0; i < this.steps.length; i++) {
        if (!this.steps[i].detached) {
          return this.steps[i];
        }
      }
    },

    // (!) Replace forEach with jQuery.each for ie compatibility
    //
    // Flatten the nested steps structure into one flat map
    // of id -> {step}

    getFlattenedSteps: function (steps) {
      var bucket = {};

      function flattenStep (step) {
        bucket[step.id] = step;
        if (step.steps) {
          jQuery.each(step.steps, function(i, step){
            flattenStep(step);
          });
        }
      }

      jQuery.each(steps, function(i, step){
        flattenStep(step);
      });
      return bucket;
    },

    // Draw first step within the container

    init: function () {
      // Call back to show that data is loaded
      if(this.options.callback){
        this.options.callback();
      }
      
      // Start
      if(!this.options.test){
        if(!this.survey.cache.getLatestSurveyId()) { // if no last survey id then start fresh
          this.drawInitialSteps();
        } else {
          this.survey.resumeFromCache();
        }
      }

      // Emit a possible cacheUnavailable event for the SurveyView to catch
      this.survey.cache.init();
     
    },

    // Draws the first step and any detached steps

    drawInitialSteps: function (steps) {

      // Draw first step

      this.surveyView.renderStep(this.firstStep);

      // Draw detached steps

      for (var i = 0; i < this.steps.length; i++) {
        if (this.steps[i].detached) {
          this.surveyView.renderStep(this.steps[i]);
        }
      }
    },

    // Displays a div with useful survey state information for 
    // debugging

    displayDebug: function () {
      jQuery('<div>')
        .addClass('decide-debug').css({
          "position":   "fixed",
          "width":      "100px",
          "top":        "30px",
          "right":      "0",
          "font-size":  "1.6em",
          "padding":    "0.4em",
          "background": "white"
        })
        .appendTo('body');

      setInterval(function () {
        jQuery('div.decide-debug').html('history:<br>' + decide.survey.history.join('<br>'));
      }, 200);
    }
  };

  // ---------------------------------------------------
  // MODEL - Survey
  // ---------------------------------------------------

  function Survey (steps, cache, firstStep) {
    this.events    = jQuery({});
    this.cache     = cache;
    this.steps     = steps;
    this.firstStep = firstStep;

    this.loadState(null);
  }

  Survey.prototype = {

    // Set model state

    loadState: function (surveyId) {
      this.surveyId  = (surveyId) ? surveyId
                                  : this.cache.getLatestSurveyId()  || null;
      this.history   = this.cache.getSurveyHistory(this.surveyId)   || [];
      this.responses = this.cache.getSurveyResponses(this.surveyId) || {};
    },

    // Set model state to fresh copy

    clearState: function () {
      this.surveyId  = null;
      this.responses = {};
      this.history   = [];

      this.events.trigger('survey.change', {
        surveyIds: this.cache.getLatestSurveyIds() // ordered oldest to latest
      });

      // Emit first step

      this.events.trigger('survey.answer', {
        newStep:        this.firstStep,
        newStepParents: this.getStepParentsById(this.firstStep.id),
        wasEdit:        false
      });
      
      // Emit detached steps

      this.triggerDetachedSteps();
    },

    // Triggers an answer event for each step in the history
    //
    // In addition it provides an answer event for the next 
    // step a person should be answering (by history & responses)

    resumeFromCache: function () {
      var history = this.history,
          i       = 0,
          newStep, lastStep, oldStepParents, newStepParents, lastDeepestStep;

      this.events.trigger('survey.new', {
        surveyId:  this.surveyId,
        surveyIds: this.cache.getLatestSurveyIds()
      });

      for (i; i < history.length; i++) {
        newStep = jQuery.extend(true, {}, this.getStepById(history[i]));
        lastStep = i > 0 ? jQuery.extend(true, {}, this.getStepById(history[i-1])) : null;
        lastDeepestStep = i > 0 ? this.getFirstDeepestStep(lastStep) : null;
        newStepParents = this.getStepParentsById(newStep.id);
        oldStepParents = lastDeepestStep ? this.getStepParentsById(lastDeepestStep.id) : [];
        this.prepareNextStep(newStep);

        this.events.trigger('survey.answer', {
          newStep:        newStep,
          wasEdit:        false,
        });
        
        this.events.trigger('survey.complete', {
          lastStep:       lastDeepestStep,
          newStepParents: newStepParents,
          oldStepParents: oldStepParents
        });
      }
      
      
      
      
      // Also draw detached steps (only if they are missing from history)

      this.triggerDetachedSteps(function (id) {
        return jQuery.inArray(id, history) > -1;
      });

      this.triggerNextFromCache();
    },

    // Called from Survey.resumeFromCache
    // TO DO make part of Survey.resumeFromCache 
    // TO DO make statements in iterator a function
    // TO DO this step could be a call to that function outside the loop

    triggerNextFromCache: function () {
      var lastStep = this.getStepById(this.history[this.history.length - 1]),
          lastDeepestStep = this.getFirstDeepestStep(lastStep),
          response = this.responses[lastDeepestStep.id],
          step = this.getStepById(response.next),
          newStepParents,
          oldStepParents;

      // Might be end of survey so check before triggering next

      if (response.next) {
        step = jQuery.extend(true, {}, step);
        this.prepareNextStep(step);
        
        newStepParents = this.getStepParentsById(step.id);
        oldStepParents = lastDeepestStep ? this.getStepParentsById(lastDeepestStep.id) : [];

        this.events.trigger('survey.answer', {
          newStep:        step,
          newStepParents: newStepParents,
          wasEdit:        false
        });
        
        this.events.trigger('survey.complete', {
          lastStep:       lastDeepestStep,
          newStepParents: newStepParents,
          oldStepParents: oldStepParents
        });
      }
    },

    // Trigger answer events for all detached steps
    //
    // A filter callback can be passed in to filter out 
    // certain detached steps. The filter should return true 
    // for if that detached step is to be skipped.

    triggerDetachedSteps: function (filter) {
      var condition;

      for (var id in this.steps) {
        condition = true;
        if (this.steps[id].detached) {
          if (filter) {
            condition = !filter(id, this.steps[id]);
          }
          if (condition) {
            this.events.trigger('survey.answer', {
              newStep:        this.steps[id],
              newStepParents: this.getStepParentsById(this.steps[id].id),
              wasEdit:        false
            });
          }
        }
      }
    },

    // Answers a step with a response and pushes it 
    // to the history

    // Triggers survey.answer with a bunch of values
    // representing the current survey state for the view.

    // If the step id is already found in the responses
    // then it assumes this answer as always an edit.

    answer: function (arg) {
      var id                 = arg.id,
          responses          = {answer: arg.answer, next: arg.next},
          lastAncestorStepId = arg.lastAncestorStepId,
          nextStep           = this.getStepById(arg.next),
          lastStep           = this.getStepById(id),
          edited             = this.isEdit(lastAncestorStepId || id),
          diverges           = false;

      // Clone the next step so you keep the original steps 
      // unchanged.

      nextStep = jQuery.extend(true, {}, nextStep);

      // Get the last stap were the history would diverge
      // Detached steps do not diverge history

      if (edited) {
        diverges = this.divergesHistory(lastAncestorStepId || id, arg.next);
      }

      // Revise and store the history

      this.reviseHistory(lastAncestorStepId || id, diverges, edited);

      // Store responses

      this.setResponse(id, responses);

      if (nextStep && nextStep.id) {
        this.prepareNextStep(nextStep);

        // Respond back to view

        this.events.trigger('survey.answer', {
          surveyId:       this.surveyId,
          wasEdit:        edited,
          newStep:        nextStep,
          lastStep:       lastStep,
          diverges:       diverges
        });
        this.events.trigger('survey.complete', {
          lastStep:       lastStep,
          newStepParents: this.getStepParentsById(nextStep.id),
          oldStepParents: this.getStepParentsById(id)
        });
      }
      else if (!lastStep.detached){
        this.events.trigger('survey.end', {
          surveyId:    this.surveyId,
          wasEdit:     edited,
          diverges:    diverges
        });
      }

      if (edited) {
        this.events.trigger('survey.edit', {step: lastStep});
      }
    },

    // Returns false if not an edit.
    // A step is considered as being edited if its in the history

    isEdit: function (id) {
      return jQuery.inArray(id, this.history) > -1;
    },


    // Truncates the history if necessary
    // Pushes the id to the history

    reviseHistory: function (id, diverges, edited) {
      if (diverges && edited) {
        this.truncateHistory(id);
      }
      // Do not push to history if entry is already 
      // at end of array or its history mapped equivelant
      if (this.history[this.history.length - 1] !== id && edited === false) {
        this.history.push(id);
      }
      this.save();
    },

    // Revert the history so the last edited step 
    // is at the end of the array

    truncateHistory: function (from) {
      var history = this.history;

      // Don't bother truncating if the edited step is
      // already at the end of the array

      if (from !== history[history.length-1]) {
        from = jQuery.inArray(from, history) + 1;
        this.history = history.slice(0, from);
      }
      this.save();
    },

    // Returns the true if the step diverges the history
    // Detached steps dont effect history divergence

    divergesHistory: function (id, nextId) {
      var pos = jQuery.inArray(id, this.history);
      if (this.getStepById(id).detached) {
        return false;
      }
      if (this.history[pos + 1]) {
        return (this.history[pos + 1] !== nextId) && !this.getStepById(this.history[pos + 1]).detached;
      }
      return (this.history[pos + 1] !== nextId);
    },
    
    // Adds any cached responses to the step.
    // Evaluates any of the steps property functions to values.

    prepareNextStep: function (nextStep) {
      var nextStepChildren = this.getStepsDirectDescendants(nextStep),
          survey           = this;

      // Note: It is safe to mutate at this point because this step was 
      // deep cloned previously in Survey.answer().
      // It is important that the subsequent methods used are used on the
      // steps directly to keep the cloned reference rather than refer 
      // to the original this.steps object.
      
      this.setStepItemValues(nextStep);
      this.evaluateStep(nextStep);

      jQuery.each(nextStepChildren, function (i, step) {
        survey.evaluateStep(step);
        if (step.items) {
          survey.setStepItemValues(step);
        }
      });


      // nextStep = this.getFirstDeepestStep(nextStep);
    },

    // Evaluate step properties which are function strings.
    // These function string should return the new value of 
    // their property.
    //
    // Evaluatated functions are passed in useful parameters.
    // See Survey.evaluateProperty() for details.

    evaluateStep: function (step) {
      var survey = this;

      jQuery.each(step, function (property, value) {
        if (typeof value === 'function') {
          survey.evaluateProperty(step, property, value);
        }
      });

      // Apply the same logic but to a step item's values

      jQuery.each(step.items || [], function (i, item) {
        if (typeof item.value === 'function') {
          survey.evaluateProperty(item, 'value', item.value);
        }
      });
    },

    // Evaluates an objects property if it is a function.
    // The function should return a value which is assigned to that 
    // property. eg:
    //
    // {
    //   mammal:  true,
    //   animal:  function () { return 'cat'; }
    // }
    //
    // -->
    //
    // {
    //   mammal: true,
    //   animal: 'cat' 
    // }
    //
    // The evaluated function has context to the Survey instance

    evaluateProperty: function (obj, property, fn) {
      var outcome = '';
      try {
        outcome = fn(obj, this.responses, this.any, this.all, this.getAnswer);
      } catch (e) {
        console.log('Error when evaluating a function property for object: ' + obj);
      }
      obj[property] = outcome;
    },

    // Sets the answered responses onto the step item's 
    // value property
    //
    // If a root or mid level step is passed the item 
    // values will be applied to its 1st deepest child

    setStepItemValues: function (step) {
    
      function setValues (items, responses) {
        var i = 0,
            j = 0;
        for (i; i < items.length; i++) {
          for (j; j < responses.length; j++) {
            if (items[i].id === responses[j].id) {
              items[i].value = responses[j].value;
            }
          }
          j = 0;
        }
      }

        
      if (this.responses[step.id] && step.items) {
        setValues(step.items, this.responses[step.id].answer);
        // pass on any answers for a custom html q
        if(step.items[0].type === 'html'){
          step.items[0].answer = this.responses[step.id].answer;
        }
      }
    },


    // Sets current survey id
    //
    // Adds a new survey to the cache
    //
    // Sets the latest survey id

    startNewSurvey: function (surveyName) {
      this.surveyId = surveyName + ' - ' + new Date();

      this.cache.addSurvey(this.surveyId);
      this.cache.setLatestSurveyId(this.surveyId);

      this.save();

      this.events.trigger('survey.new', {
        surveyId: this.surveyId,
        surveyIds: this.cache.getLatestSurveyIds() // ordered oldest to latest
      });
    },

    // Changes the current survey via a surveyId and changes the state of 
    // the current responses, history and steps.
    //
    // Sets the latest survey id

    change: function (surveyId) {
      this.loadState(surveyId);
      
      if (surveyId) {
        this.cache.setLatestSurveyId(surveyId);
      }
      
      this.events.trigger('survey.change', {
        surveyIds: this.cache.getLatestSurveyIds(), // ordered oldest to latest
        surveyId:  this.surveyId
      });
      
      // If the current state has history then trigger all the steps
      // else trigger with default steps

      if (this.history.length > 0) {
        this.resumeFromCache();
      } else {
        this.events.trigger('survey.answer', {
          newStep:        this.firstStep,
          newStepParents: this.getStepParentsById(this.firstStep.id),
          wasEdit:        false
        });

        this.triggerDetachedSteps();
      }
    },

    // Deletes survey and resets state to a previous survey
    // if no previous survey is found then it starts fresh with 
    // the same steps

    remove: function (surveyId) {
      this.cache.removeSurvey(surveyId || this.surveyId);
      this.events.trigger('survey.delete', {
        surveyIds: this.cache.getSurveyIds()
      });
      this.change(this.cache.getLatestSurveyId());
    },

    // Save the history and responses to the cache but check for the 
    // existence of a surveyId as there are a few steps prior to adding
    // the survey to the cache

    save: function () {
      if (this.surveyId) {
        this.cache.setSurveyHistory(this.surveyId, this.history);
        this.cache.setSurveyResponses(this.surveyId, this.responses);
        this.events.trigger('survey.save', {when: new Date()});
      }
    },

    // Returns a report array with each entry containing an object 
    // with the question description and response(s) given

    generateReportArray: function () {
      var survey = this;
      return jQuery.map(this.history, function (stepId) {
        if (step.type === 'question') {
          var step = survey.getStepById(stepId);
          return {
            question: step.description,
            answers:  survey.responses[stepId]
          };
        }
      });
    },

    // Returns a step by its id

    getStepById: function (id) {
      return this.steps[id];
    },

    // Adds or edits the response object

    setResponse: function (id, responses) {
      this.responses[id] = responses;
      this.save();
    },

    // Gets from responses

    getResponse: function (id) {
      return this.responses[id];
    },

    // Returns an array of ancestors (from closest to oldest) steps

    getStepParentsById: function (id, arr) {
      var step   = this.getStepById(id),
          parent;

      arr = arr || [];
      
      if (step.parent) {
        parent = this.getStepById(step.parent);
        arr.push(parent);
        this.getStepParentsById(parent.id, arr);
      }

      return arr;
    },

    // Get all the direct descendants of the passed step object

    getStepsDirectDescendants: function (step) {
      var steps    = [],
          thisStep = step;

      while(thisStep.steps) {
        steps.push(thisStep.steps[0]);
        thisStep = thisStep.steps[0];
      }

      return steps;
    },

    // Returns the first deepest step of a given step
    // If no deeper steps are possible it returns itself

    getFirstDeepestStep: function (step) {
      var thisStep = step,
          items    = step.items,
          steps    = step.steps;

      while(thisStep.steps){
        thisStep = steps[0];
        items = thisStep.items;
        steps = thisStep.steps;
      }

      return thisStep;
    },

    // Shortcut methods for instead of writing numerous conditional
    // operators in step items which have evaluate functions

    any: function (expressions) {
      var isTrue = false,
          i      = 0;
      for (i; i < expressions.length; i++) {
        if (expressions[i]) {
          isTrue = true;
        }
      }
      return isTrue;
    },

    all: function (expressions) {
      var foundFalse = false,
          i          = 0;
      for (i; i < expressions.length; i++) {
        if (expressions[i] === false) {
          foundFalse = true;
        }
      }
      return !foundFalse;
    },

    getAnswer: function (id) {

    }

  };

  // ---------------------------------------------------
  // CACHE - CacheManager
  // ---------------------------------------------------


  function CacheManager () {
    this.events = jQuery({});

    // Contains a an object with each property being a 
    // survey id

    this.surveys = new Cache('surveys');
    if (!this.getSurveyIds()) {
      this.surveys.set('surveys', []);
    }

    // Contains an object with each property being a 
    // survey id + responses or
    // survey id + history

    this.surveyData = new Cache('surveyData');

    // Contains surveyIds in order of last surveys worked on
    // (Last = most recent)

    this.latest = new Cache('latest');
    if (!this.getLatestSurveyIds()) {
      this.latest.set('latest', []);
    }
  }

  CacheManager.prototype = {

    // Checks to see if localStorage is available and 
    // publishes an event if it is not

    init: function () {
      var hasLocalStorage = function() {
        try {
          localStorage.setItem('localStorageTest', 'foo');
          localStorage.removeItem('localStorageTest');
          return true;
        } catch(e) {
          return false;
        }
      };

      if (hasLocalStorage()) {
        this.events.trigger('cacheManager.cacheUnavailable');
      }
    },

    // Add a new survey id to the survey cache
    // as well as making appopriate namespaces 
    // for that survey in the surveyData cache

    addSurvey: function (surveyId) {
      var surveys = this.surveys.get('surveys');
      surveys.push(surveyId);
      this.surveys.set('surveys', surveys);
      
      this.surveyData.set(surveyId + 'steps', {});
      this.surveyData.set(surveyId + 'history', []);
      this.surveyData.set(surveyId + 'responses', {});
      this.surveyData.set(surveyId + 'thirdPartyId', "");
    },

    // Returns an array of survey ids

    getSurveyIds: function () {
      return this.surveys.get('surveys');
    },

    // Remove a survey id from the survey cache
    // and removes the related responses, history 
    // and steps from the related surveyData caches

    removeSurvey: function (surveyId) {
      var surveys = this.surveys.get('surveys'),
          latests = this.latest.get('latest'),
          indexPos;

      // Remove from surveys array
      indexPos = jQuery.inArray(surveyId, surveys);
      if (indexPos > -1) {
        surveys.splice(jQuery.inArray(surveyId, surveys), 1);
      }
      this.surveys.set('surveys', surveys);

      // Remove from latest surveys array
      indexPos = jQuery.inArray(surveyId, latests);
      if (indexPos > -1) {
        latests.splice(jQuery.inArray(surveyId, latests), 1);
      }
      this.latest.set('latest', latests);

      // and related survey data
      this.surveyData.remove(surveyId + 'steps');
      this.surveyData.remove(surveyId + 'history');
      this.surveyData.remove(surveyId + 'responses');
      this.surveyData.remove(surveyId + 'thirdPartyId', "");
    },

    // Returns a surveyId representing the last survey worked 
    // on or false if none exist

    getLatestSurveyId: function () {
      var ids = this.latest.get('latest');
      if (jQuery.isArray(ids)) {
        return ids[ids.length-1];
      }
      return false;
    },

    // Returns a list of surveyIds in the latest order with latest 
    // being at the end.

    getLatestSurveyIds: function () {
      return this.latest.get('latest') || false;
    },

    // Return a survey responses object when providing a surveyId

    getSurveyResponses: function (surveyId) {
      return this.surveyData.get(surveyId + 'responses');
    },

    // Return a survey history array when providing a surveyId

    getSurveyHistory: function (surveyId) {
      return this.surveyData.get(surveyId + 'history');
    },
    
    // Returns an id to be used by any third party (e.g. storage) service
    getThirdPartyId: function (surveyId) {
      return this.surveyData.get(surveyId + 'thirdPartyId');
    },

    // Set the specific survey last worked on via its surveyId

    setLatestSurveyId: function (surveyId) {
      var arr = this.latest.get('latest'),
          indexPos;

      if (arr.length > 0) {
        indexPos = jQuery.inArray(surveyId, arr);
        if (indexPos > -1) {
          arr.splice(indexPos, 1);
        }
      }

      arr.push(surveyId);
      this.latest.set('latest', arr);
    },

    // Set the specific survey's (via surveyId) responses object

    setSurveyResponses: function (surveyId, responses) {
      this.surveyData.set(surveyId + 'responses', responses);
    },
    
    // Set the specific survey's (via surveyId) history array

    setSurveyHistory: function (surveyId, history) {
      this.surveyData.set(surveyId + 'history', history);
    },
    
    // Adds an id to be used by any third party (e.g. storage) service
    setThirdPartyId: function (surveyId, thirdPartyId) {
      this.surveyData.set(surveyId + 'thirdPartyId', thirdPartyId);
    }
  };

  // ---------------------------------------------------
  // VIEW - SurveyView
  // ---------------------------------------------------


  function SurveyView (decide, container, templates, options) {
    this.events    = jQuery({});
    this.container = jQuery(container);
    this.templates = templates;
    this.options   = options;
    this.surveyId  = null;
    
    this.setupDecideEvents(decide);
    this.setupDomEvents();
    this.drawGuiComponents();
  }

  SurveyView.prototype = {
    
    // Listen for Decide (controller) events

    setupDecideEvents: function (decide) {
      var surveyView = this;

      decide.on('decide.answer', function (event, arg) {
        // arg 
        //     .newStep         - step object
        //     .wasEdit         - If the last answer counted as an edit
        //     .lastStep        - the last question answered
        //     .diverges        - the last q. diverges from the existing question 'path'


        if (arg.wasEdit && arg.diverges) {
          surveyView.clearStepsAfter(arg.lastStep);
          surveyView.renderStep(arg.newStep);
        }
        else if (arg.wasEdit === false) {
          surveyView.renderStep(arg.newStep);
        }

      });

      decide.on('decide.complete', function (event, arg) {        
        if(arg.lastStep){
          var thisStep = arg.lastStep;
          while(thisStep){
            if(!thisStep.steps){
              surveyView.markStepComplete(thisStep.id);
              break;
            }
            thisStep = thisStep.steps[0];
          }
        }
        if (arg.oldStepParents) {
          surveyView.markAncestorsComplete(arg.oldStepParents, arg.newStepParents);       
        }
      });
      
      decide.on('decide.edit', function (event, arg) {
        // arg.step - the step just edited
      });

      decide.on('decide.newSurvey', function (event, arg) {
        surveyView.setCurrentSurveyId(arg.surveyId);
        surveyView.drawNewSurveyButton();
        surveyView.drawDeleteButton();
        surveyView.drawSurveySelect(arg.surveyIds);
      });

      decide.on('decide.delete', function (event, arg) {
        var latest = arg.surveyIds[arg.surveyIds.length - 1] || null;
        surveyView.setCurrentSurveyId(latest);

        if (latest) {
          surveyView.changeSurvey(latest);
        } 

        surveyView.clearSteps(arg.surveyIds);
      });

      decide.on('decide.change', function (event, arg) {
        surveyView.setCurrentSurveyId(arg.surveyId);
        surveyView.clearSteps(arg.surveyIds);
      });

      decide.on('decide.save', function (event, arg) {
        // (!) Show the person some save confirmation
      });

      decide.on('decide.end', function (event, arg) {

      });

      decide.on('decide.cacheUnavailable', function (event, arg) {
        surveyView.drawMessage('Your web browser doesn\'t support the technology to save your progress.');
      });
    },
    
    // Listeners for DOM events (button clicks etc)

    setupDomEvents: function () {
      var surveyView = this;

      surveyView.container.on('click', 'input[type="submit"][data-next]', function (e) {
        surveyView.handleNextButton(e.target);
      });

      surveyView.container.on('click', '.create', function (e) {
        surveyView.handleNewSurveyButton(e.target);
        return false;
      });

      surveyView.container.on('click', '.delete', function (e) {
        surveyView.handleDeleteButtonPress(e.target);
        return false;
      });

      surveyView.container.on('change', 'select.surveys', function (e) {
        surveyView.handleSurveySelect(e.target);
      });
    },

    setCurrentSurveyId: function (id) {
      this.surveyId = id || null;
    },
    
    // Clears the container and updates the visual state of the 
    // delete button and survey select

    clearSteps: function (surveyIds) {
      this.container.html('<nav class="header">');
      this.drawNewSurveyButton();
      this.drawDeleteButton();
      this.drawSurveySelect(surveyIds);
    },

    changeSurvey: function (surveyId) {
      this.events.trigger('surveyView.changeSurvey', {
        surveyId: surveyId
      });
    },

    // Draws the Survey GUI Components:
    //
    // - Survey select drop down
    // - Survey create button
    // - Survey delete button

    drawGuiComponents: function () {
      jQuery('nav', this.container).remove();
      jQuery(this.container).prepend('<nav class="header">');
      this.drawNewSurveyButton();
      this.drawSurveySelect();
      this.drawDeleteButton();
    },

    // DOM event handling

    handleNextButton: function (target) {
      var response   = {},
          surveyView = this,
          stepId = surveyView.getStepId(target),
          surveyName;

      if (surveyView.valid(stepId)) {
      
        surveyView.clearWarning(stepId);
        

        response.next               = surveyView.getNextStep(target);
        response.lastAncestorStepId = surveyView.getLastAncestorStepId(target);
        response                    = surveyView.compileResponse(target, response);
        
        surveyView.events.trigger('surveyView.answer', response);

        surveyName = surveyView.getSurveyName(response);

        if(surveyName){
          surveyView.events.trigger('surveyView.startNewSurvey', surveyName);
        }
        
        if(!response.next){ // detached or last
          surveyView.markStepComplete(stepId); 
        }
        
      }else{
        surveyView.renderFeedbackWarning(stepId);
      }
    },

    getSurveyName : function getSurveyName(response){
      var length = response.answer.length,
          answers = response.answer;
      // if the survey has not yet started
      if(!this.surveyId){
        // for each answer in the response,
        for(var i=0;i<length;i++){
          // if this item's id is the id given in options,
          if(answers[i].id === this.options.startId){
            return answers[i].value;
          }
        }
      }
      return false;
    },

    handleSurveySelect: function (target) {
      var surveyId = jQuery(target).val();
      if (surveyId) {
        this.changeSurvey(surveyId);
      }
    },

    handleDeleteButtonPress: function (target) {
      if (!jQuery(target).attr('disabled')) {
        // if (confirm('Delete the survey "' + this.surveyId + '"?')) {
          this.events.trigger('surveyView.deleteSurvey', {
            surveyId: this.surveyId
          });
        // }
      }
    },

    handleNewSurveyButton: function (target) {
      this.setCurrentSurveyId(null);
      this.events.trigger('surveyView.blankSurvey');
    },

    // Draws the survey select dropdown.
    //
    // If supplied with an array of survey ids it will 
    // add them to the select as options.

    drawSurveySelect: function (surveyIds) {
      var select  = this.getTemplate('survey_select'),
          option  = this.getTemplate('survey_select_option'),
          options = this.getTemplate('survey_select_option_default'),
          latest;

      if (surveyIds) {        
        if (surveyIds.length > 0) {
          if (this.surveyId) { // If surveyId set then clear "Untitled Survey"
            options = '';
          }
          latest = surveyIds.pop();
          surveyIds.sort();
          options += tim(option, {value: latest, display: latest});
          jQuery.each(surveyIds, function (i, surveyId) {
            options += tim(option, {value: surveyIds[i], display: surveyIds[i]});
          });
        }
      }

      jQuery('nav select.surveys', this.container).remove();
      jQuery(select).append(options).prependTo(jQuery('nav', this.container));
    },

    // Draws the delete button

    drawDeleteButton: function () {
      var button;

      jQuery('nav .delete', this.container).remove();

      button = jQuery('<a class="button" href="#">').addClass('delete')
                .text('Delete Survey').appendTo(jQuery('nav', this.container));
      
      if (!this.surveyId) {
        button.attr('disabled', 'disabled');
      }
    },

    // Draws the create new survey button

    drawNewSurveyButton: function () {
      jQuery('nav .create', this.container).remove();
      jQuery('<a class="button" href="#">')
        .addClass('create')
        .text('Create New Survey')
        .appendTo(jQuery('nav', this.container));
    },

    // Draws or overwrites a previously drawn message box with some html/text

    drawMessage: function (html) {
      var messageBar = jQuery('div.message-bar');
      if (messageBar.length) {
        messageBar.html(html);
      } else {
        jQuery('<div>').html(html).addClass('message-bar').prependTo(this.container);
      }
    },

    // Derives the id of the next step to go to,
    // based on the data in this question
    getNextStep : function getNextStep(button){
      return button.getAttribute('data-next'); 
    },
    
    getStepId : function getStepId (button){
      return button.parentNode.getAttribute('id');
    },

    getLastAncestorStepId : function getLastAncestorStepId (button){
      return button.getAttribute('data-id');
    },

    // Looks through the mini 'form' for this step 
    // and compiles the response array of objects
    // response format: [{ id "2.1.1", value : "Yes" }]
    compileResponse : function compileResponse(button, response){    
      var surveyView = this;
      
          response.id = surveyView.unformatId(this.getStepId(button));
          response.answer = [];      
      
      // find the parent element (as renderStep appends the button
      // at the same level as the list of question items)
      jQuery(button).parent().find('select, textarea, input[type="checkbox"], input[type="text"], [data-type="radio"]').each(function(){
        var $this = jQuery(this),
            selected = $this.find(":selected"),
            next = selected.length ? selected[0] : this,
            type = this.getAttribute('type') || this.getAttribute('data-type'),
            id, checked, 
            item = { }; 
        
        next = next.getAttribute('data-next');
        
        if(type === 'radio'){
          id = this.getAttribute('data-id');
          item.id = surveyView.unformatId(id);
          checked = $this.find('[name='+id+']:checked');
          item.value = surveyView.unformatId(checked.attr('id'));
          next = checked.attr('data-next');
        }else{
          item.id = surveyView.unformatId($this.attr('id'));
          item.value = (type === 'checkbox') ?
                      Boolean(this.getAttribute('checked')) : 
                      $this.val();
        }
        
        // Add in a answer dependent next question value
        if(!response.next && next){
          response.next = next;
        }
        
        response.answer.push(item);    
      });
      
      return response;
    },
    
    markStepComplete : function markStepComplete(id){
      if(!id){
        return;
      }
      var domId = this.formatId(id);
      document.getElementById(domId).setAttribute('data-complete', "");
      this.events.trigger('surveyView.stepComplete', { 'id' : domId });
    },
    
    markAncestorsComplete : function markAncestorsComplete(oldStepParents, newStepParents){
    var i, oldParent, olength = oldStepParents.length,
            oldId, newId,
            oldAncestors = oldStepParents.reverse(),
            j, newParent, nlength = newStepParents.length, 
            newAncestors = newStepParents.reverse(),
            alength = olength > nlength ? olength : nlength;
        
        for(i=alength-1; i>=0; i--){
          oldParent = oldAncestors[i];
          newParent = newAncestors[i];
          oldId = oldParent ? oldParent.id : "";
          newId = newParent ? newParent.id : "";
          if(oldId !== newId){
            this.markStepComplete(oldId);
          }
        }   
    },

    // RENDERING

    // Renders a step into a parent jQuery collection
    
    renderStep: function renderStep(step) {
      var html = "",
          items = step.items,
          steps = step.steps,
          parent = step.parent ? jQuery("#" + this.formatId(step.parent)) : null, 
          container = this.container,
          thisStep = step,
          $detachedStep = jQuery('.detached'),
          prevStep,  $thisStep;
      
      // Add outer container
      html = jQuery(this.renderItem(step));
      prevStep = html;
      
      // move through, render and append all child steps in order
      while(steps){
        thisStep = steps[0];
        $thisStep = jQuery(this.renderItem(thisStep));
        prevStep.append($thisStep);
        
        // move in a level
        prevStep = $thisStep;
        items = thisStep.items;
        steps = thisStep.steps;
      }
      
      // now at last step, add the items
      prevStep.append(
                this.renderItems(items)
              ).append(
                this.createNextButton(items, thisStep.next, step.id, thisStep.buttonText)
              );
      
      container = parent ? container.find(parent) : container;
      
      // Always render non-detached steps before detached steps

      // aka: If there are detached steps on the page and the current step is 
      // not a detached step and the oldest ancestor
      if ($detachedStep.length > 0 && !step.detached && !step.parent) {
        jQuery(html).insertBefore($detachedStep.first());
      }
      else {
        container.append(html);
      }
      
      // ensure custom html has updated values
      this.updateCustomHtml(items);
      
      if(step.detached){
        this.markStepComplete(step.id);
      }else{
        // set focus on on first form element
        jQuery(html).find(':input:visible:enabled:first, [tabindex="-1"]').first().focus();
      }
    },
    
    // renders an array of items which are then appended to 
    // an jquery collection 
    renderItems: function renderItems(items) {  
      var html = "", itemHtml, item, length, container, $html= "", label;
      if(items){  
        length = items.length;
        
        for(var i=0;i<length;i++){
          item = items[i];
          itemHtml = this.renderItem(item);
          if(item.options){
            itemHtml = this.renderOptions(item, itemHtml);
          }
          html += itemHtml;
        }
        container = jQuery(tim(this.getTemplate('items')));
        
        if(length === 1 && items[0].type !== 'html'){
          $html = jQuery(html);
          // add a title to the only item
          label = $html.children('label');
          if($html.children('label').length === 1){
            label.addClass('title');
          }
          // add everything but the title to the container
          $html.children(':not(.title)').wrapAll(container);
        }else{
          // add everything to the container
          $html = container.append(html);
        }
      }
      return this.jQueryToString($html);
    },
    
    renderOptions : function renderOptions(item, itemHtml){
      var $item = jQuery(itemHtml),
          opts = item.options,
          isSelect = item.type === 'select',
          opt,
          optWrapper =  isSelect ? $item.find('select') : $item;
      
      // Add 'not selected' option
      if(isSelect){
        opts.unshift({
          "id" : "-1",
          "answer" : this.options.selectDefault
        });
      } 
      
      for(var i=0;i<opts.length;i++){
        opt = opts[i];
        // TO DO  label/title is missing for radio button (add as for other headers)
        opt.type = item.type + '_option';
        opt.name = this.formatId(item.id); 
        opt.next = opt.next || "";
        opt.selected = "";
        if(item.type === 'select'){
          opt.value = opt.id;
        }
        // set the chosen option
        if(item.value === opt.id){
          if(item.type === 'radio'){
            opt.value = 'checked';
          }
          if(item.type === 'select'){
            opt.selected = 'selected';
          }
        }
        optWrapper.append(this.renderItem(opt));
      }
      
      return this.jQueryToString($item);
    },
    
    renderItem: function renderItem(step) {
      var html = "",
          template = this.getTemplate(step);
      if(template){
        html = this.formatTemplate(template, step);
      }else{
        new Error('surveyView.renderItem: template not available for this step');
      }
      
      return html;
      
    },
    
    // Adds a next button to a list of question items    
    createNextButton : function createNextButton(items, next, id, buttonText){
      var template = this.getTemplate('next'),
          button = "";
          
      items = items || {};
      items.buttonText = buttonText || this.options.buttonText;
      items.next = next || "";
      items.id    = id   || "";
      
      if(template){
        button = tim(template, items);
      }
      
      return button;
    },
    
    updateCustomHtml : function updateCustomHtml(items){
      var i, length, answer;
      
      if(!items){
        return;
      }
      var item = items[0],
          container, answer;
      
      if(item.type !== 'html'){
        return;
      }
      
      if(item.answer){
        length = item.answer.length
        for(i=0;i<length;i++){
          answer = item.answer[i];
          jQuery('#'+this.formatId(answer.id)).val(answer.value);
        }
      }
      
    },
    
    // Fetches an HTML template string from the templates object
    // given a template identifier. This can be passed in as a string, 
    // or derived from the step object
    getTemplate: function getTemplate(key){
      var template = null,
          templates = this.templates;
      if(typeof key !== 'string'){    
        if(key.type){
            key = (key.type === 'html') ? key.src : key.type;
        }
        else if(key.label){
          key = key.label;
        }
      }
      for(var i=0;i<templates.length;i++){
        if(templates[i].type === key){
          template = templates[i].template;
        }
      }
      
      templates = null;
      return template;
    },
    
    // Adds any additional/conditional formatting to a step
    // before rendering as html using tim.
    formatTemplate : function formatTemplate(template, theStep) {
      var $html, label,
          step = jQuery.extend(true, {}, theStep);
          
      step.value = (step.type === 'html') ? step.id : (step.value || '');
      if(step.type === 'checkbox' && step.value === true){
        step.value = 'checked';
      } 
      
      step.id = this.formatId(step.id);
      
      step.className = step.className || ''; 
      step.required = step.required || ''; 
      
      
      $html = jQuery(
                tim(template, step)
              ).prepend(
                this.addHeader(step)
              );
              
      $html = this.formatLabel($html, step);
      
      return this.jQueryToString($html);
      
    },
    
    // Get a sub-template to add to a jquery 'element'
    // position  - 'append', 'prepend', etc 
    addCustomText : function addCustomText($el, template, position, obj){
      return $el[position](tim(this.getTemplate(template), obj));
    },
    
    // Add common text items to an item/step
    addCommonTextItems : function addCommonTextItems($el, step){
      if(step.num){
        this.addCustomText($el, 'num', 'prepend', step);
      }
      if(step.instructions){
        this.addCustomText($el, 'instructions', 'append', step);
      }
      return $el;
    },
    
    // conditionally formats a jquery element containing a label,
    // adding instrutions and custom numbering
    formatLabel : function formatLabel($html, step){
      var label;
      if(step.label){
        label = $html.find('label');
        this.addCommonTextItems(label, step);
        this.addPrompts($html, step,  label, 'after');
      }      
      return $html;
    },
    
    // TO DO  this should be generalised to an addContainerAndList function - 
    // The 'prompts' (list items) should be appended to the 'prompts' el, 
    // before it's appended to the $el
    addPrompts : function addPrompts($el, obj, $container, position){
      if(obj.prompts){
        this.addCustomText($container, 'prompts', position, obj);
        var length = obj.prompts.length,
            prompts = $el.find('.prompts');
        for(var i=0;i<length;i++){
          this.addCustomText(prompts, 'prompt', 'append', {'prompt':obj.prompts[i]});
        }
      }
      return $el;
    },
    
    // returns a string for a title section or an empty string
    addHeader : function addHeader(step){
      var titleTemplate = 'title', title, overview, description;
          
      if(step.title || (step.type === 'radio')){  
        
        if(step.type === 'radio'){
          step.title = step.label;
          titleTemplate = 'radio_label';
        }
        
        overview = jQuery(tim(this.getTemplate(titleTemplate), step));
       
        title = overview.hasClass('title') ? overview : overview.find('.title');
        
        this.addCommonTextItems(title, step);
        
        if(step.subtitle){
          this.addCustomText(overview, 'subtitle', 'append', step);
        }
        
        if(step.description){
          description = '<p>' + step.description + '</p>',
          description = description.replace(/\n\n/g, "</p><p>");
          description = description.replace(/\n/g, "<br>");
          description = description.replace(/\'/g, "&#8217;");
          description = { "description" : description };
          
          this.addCustomText(overview, 'description', 'append', description);
        }
        
        
        this.addPrompts(overview, step, overview, 'append');
        
        return this.jQueryToString(overview);
        
      }
      
      return "";
    },
    
    // Removes . from id's to be used in html, and prepends with text
    formatId : function formatId(id, prefix){
      var idString = id;
      prefix = prefix || this.options.idPrefix;
      if(isNaN(idString.charAt(0)) === false){
        idString = prefix + id;
      }
      if(idString.indexOf('.') !== -1){
        idString = idString.replace(/\./g, '_');
      }
      return idString;
    },
    
    // Reverses formatId
    unformatId : function unformatId(id){
      if(id){
        if(id.indexOf(this.options.idPrefix) !== -1){
          id = id.substring(this.options.idPrefix.length);
        }
        if(id.indexOf('_') !== -1){
          id = id.replace(/\_/g, '.');
        }
      }      
      return id;
    },
    
    jQueryToString : function jQueryToString($colln){
      if($colln instanceof jQuery){
        return jQuery('<i>').append(($colln).clone()).html();
      }else {
        return "";
      }
    },
    
    // Returns true if the step container has 
    // correctly entered fields

    valid: function (id) {
      var valid = true,
          select = this.requiresValidation(id, 'select', 'option'),
          radio = this.requiresValidation(id, '[data-type="radio"]', 'input'),
          other = this.requiresValidation(id, '[data-id]');
          
      if(select){
        valid = this.isValid(select, 'option:selected[value!="-1"]');
      }  
      if(radio){
        valid = this.isValid(radio, 'input[type="radio"]:checked');
      } 
      if(other){
        valid = jQuery(other).find('[type="text"]').val();
      }
        
      return valid;
    },
    
    isValid : function isValid(item, option){
      if(jQuery(item).find(option).length){
        return true;
      }
      return false;
    },
    
    requiresValidation : function requiresValidation(id, sel, item){
      var validate, 
          requiredItem = false;
      // get all containers
        jQuery('#'+id).find(sel).each(function(){
          
          if(item){
            // if this has any items with data-next val
            jQuery(this).find(item).each(function(){
              if(this.getAttribute('data-next')){
                validate=true;
              }
            });
          }else{  
            if(this.getAttribute('data-required')){
              requiredItem = this;
              return ;
            }
          }
          
          if(validate){
            requiredItem =  this;
          }
          
        });  
      
      
      return requiredItem;
    },

    // Removes all the steps from the container after a specific step

    clearStepsAfter: function (lastStep) {
      var questionStep = jQuery('#' + this.formatId(lastStep.id));

      questionStep.nextUntil('.detached').remove();

      questionStep.parentsUntil(this.container).each(function () {
        jQuery(this).nextUntil('.detached').remove();
      });
    },

    // Remove warning from a step

    clearWarning: function (id) {
      jQuery('#' + this.formatId(id) + ' .warning').remove();
    },

    // Present a warning as feedback under a step

    renderFeedbackWarning: function renderFeedbackWarning(id) {
      var item = jQuery('#' + id), warning;
      if(item.find('.warning').length === 0){
        warning = item.find('[data-required]').attr('data-required') || this.options.warning;
        jQuery('#' + this.formatId(id)).append(tim(this.getTemplate('warning'), { 'warning' : warning }));
      }
    },

    // Removes DOM elements from the page. 
    //
    // Even though Decide can be overriden the events SurveyView 
    // assigns to the page remain.
    //
    // Usage:
    //
    // decide.surveyView.removeDomEvents();
    // decide = new Decide(...);

    removeDomEvents: function () {
      this.container.off('click', 'input[type="submit"][data-next]');
      this.container.off('click', '.delete');
      this.container.off('click', '.create');
      this.container.off('change', 'select.surveys');
    }

  };

  return Decide;
  
}(window, document));