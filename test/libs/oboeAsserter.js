/*
   Assertion helpers for testing the interface exposed as window.oboe
   
   These assertions mostly rely on everything that sits behind there as well (so they aren't
   true unit testing assertions, more of a suite of component testing helpers).

 */

var givenAnOboeInstanceGetting = givenAnOboeInstance; // givenAParserFetching is a synonym for givenAParser

function givenAnOboeInstance(jsonFileName, jstdCallbacksListForJsonComplete, callbackFromTest) {

   function Asserter() {

      var oboeInstance,

          expectingErrors = false,
          
          givenErrors = [],
          
          completeJson, // assigned in the requestCompleteCallback

          spiedCallback; //erk: only one callback stub per Asserter right now :-s
          
          
      jsonFileName = jsonFileName || 'invalid://xhr_should_be_stubbed.org/if/not/thats/bad';
       
      function storeCompleteJson(completeJsonFromJsonCompleteCall){
         completeJson = completeJsonFromJsonCompleteCall;
         
         if( callbackFromTest ) {
            callbackFromTest.apply(this, arguments);
         }
      } 
       
      /* we are testing with real http if a filename was given. Generally this is a bad thing
      *  but is useful for component tests. Where possible we shouldn't do this.  */
      var requestCompleteCallback = jstdCallbacksListForJsonComplete? 
                                          jstdCallbacksListForJsonComplete.add(storeCompleteJson) 
                                       :  storeCompleteJson;

      oboeInstance = oboe.doGet( urlForJsonTestFile(jsonFileName), 
                                 requestCompleteCallback
                               );      
      
      /**
       * Fetch the given test json file.
       * 
       * Unless the browser's xhr or streamingXhr has been stubbed, this will make an actual
       * ajax call. In which case this is for end-to-end testing only.
       * 
       * @param {String} jsonFilename
       * @param {Function} [callbackFromTest] a callback for when all the json has been read
       */
      this.makeRequestFor = function(jsonFilename, jstdCallbacksList, callbackFromTest) {
            
         oboeInstance.doGet(urlForJsonTestFile(jsonFilename), callback);
         
         return this;
      };                
          
      oboeInstance.onError(function(e) {
         // Unless stated, the test isn't expecting errors. Fail the test on error: 
         if(!expectingErrors){ 
            givenErrors.push(e);
         
            fail('unexpected error: ' + e);
         }
      });

      this.andWeAreListeningForNodes = function(pattern, callback, scope) {
         spiedCallback = callback ? sinon.stub() : sinon.spy(callback);
      
         oboeInstance.onNode(pattern, argumentClone(spiedCallback), scope);
         return this;
      };

      this.andWeAreListeningForPaths = function(pattern, callback, scope) {
         spiedCallback = callback ? sinon.stub() : sinon.spy(callback);      
      
         oboeInstance.onPath(pattern, argumentClone(spiedCallback), scope);
         return this;
      };
      
      this.andWeHaveAFaultyCallbackListeningFor = function(pattern) {
         spiedCallback = sinon.stub().throws();      
      
         oboeInstance.onPath(pattern, argumentClone(spiedCallback));
         return this;
      };      
      
      this.andWeAreExpectingSomeErrors = function() {
         expectingErrors = true;
      
         spiedCallback = sinon.stub();
         
         oboeInstance.onError(argumentClone(spiedCallback));
         return this;
      };
                 
      this.whenGivenInput = function(json) {
         if( typeof json != 'string' ) {
            json = JSON.stringify(json);
         }

         // NOTE: this will only work if streamingXhr has been stubbed. We look up what was passed to it as the
         // progress callback and give the string to that.
         var progressCallback = streamingXhr.firstCall.args[3];
         
         // giving the content one char at a time makes debugging easier when
         // wanting to know how much has been written into the stream.
         for( var i = 0; i< json.length; i++) { 
            progressCallback(json.charAt(i));          
         }                  

         return this;
      };
      
      this.whenInputFinishes = function() {

         // NOTE: this will only work if streamingXhr has been stubbed. We look up what was passed to it as the
         // done callback
         var doneCallback = streamingXhr.firstCall.args[4];
         
         doneCallback();                  

         return this;         
      };

      function noop(){}
      
      /**
       * Assert any number of conditions were met on the spied callback
       */
      this.thenTheInstance = function( /* ... functions ... */ ){
      
         if( givenErrors.length > 0 ) {
            fail('error found during previous stages\n' + givenErrors[0].stack);
         }      
      
         for (var i = 0; i < arguments.length; i++) {
            var assertion = arguments[i];
            assertion.testAgainst(spiedCallback, oboeInstance, completeJson);
         }

         return this;
      };
      
      /** sinon stub is only really used to record arguments given.
       *  However, we want to preserve the arguments given at the time of calling, because they might subsequently
       *  be changed inside the parser so everything gets cloned before going to the stub 
       */
      function argumentClone(delegateCallback) {
         return function(){
         
            function clone(original){
               // Note: window.eval being used here instead of JSON.parse because
               // eval can handle 'undefined' in the string but JSON.parse cannot.
               // This isn't wholy ideal since this means we're relying on JSON.
               // stringify to create invalid JSON. But at least there are no
               // security concerns with this being a test. 
               return window.eval( '(' + JSON.stringify( original ) + ')' );
            }
            function toArray(args) {
               return Array.prototype.slice.call(args);
            }
            
            var cloneArguments = toArray(arguments).map(clone);
            
            delegateCallback.apply( this, cloneArguments );
         };
      }      
   }
   return new Asserter();
}

/* get the url that jstd will serve a test json file on */
function urlForJsonTestFile(jsonFilename) {
   return '/test/test/json/' + jsonFilename;
}


var wasPassedAnErrorObject = {
   testAgainst: function failIfNotPassedAnError(callback, oboeInstance) {
   
      if( !callback.args[0][0] instanceof Error ) {
         fail("Callback should have been given an error but was given" + callback.constructor.name);
      }
      
   }
};


// higher-order function to create assertions. Pass output to Asserter#thenTheInstance.
// test how many matches were found
function foundNMatches(n){
   return {
      testAgainst:
      function(callback, oboeInstance) {
         if( n != callback.callCount ) {
            fail('expected to have been called ' + n + ' times but has been called ' +
               callback.callCount + ' times. \n' +
                   "all calls were with:" +
                   reportArgumentsToCallback(callback.args)
            )
         }
      }
   }
}

// To test the json at oboe#json() is as expected.
function hasRootJson(expected){
   return {
      testAgainst:
      function(callback, oboeInstance) { 
         assertEquals(expected, oboeInstance.root());         
      }
   }
}

// To test the json given as the call .onGet(url, callback(completeJson))
// is correct
function gaveFinalCallbackWithRootJson(expected) {
   return {
      testAgainst:
         function(callback, oboeInstance, completeJson) { 
            assertEquals(expected, completeJson);         
         }
   }
}

var foundOneMatch = foundNMatches(1),
    calledCallbackOnce = foundNMatches(1),    
    foundNoMatches = foundNMatches(0);

function calledbackWithContext(callbackScope) {
   return { 
      testAgainst:
      function(callbackStub, oboeInstance) {
         if(!callbackStub.calledOn(callbackScope)){
         
            if( !callbackStub.called ) {
               fail('Expected to be called with context ' + callbackScope + ' but has not been called at all');
            }
         
            fail('was not called in the expected context. Expected ' + callbackScope + ' but got ' + 
               callbackStub.getCall(0).thisValue);
         }   
      }
   };
}

function lastOf(array){
   return array[array.length-1];
}
function penultimateOf(array){
   return array[array.length-2];
}
function prepenultimateOf(array){
   return array[array.length-3];
}

/**
 * Make a string version of the callback arguments given from oboe
 * @param {[[*]]} callbackArgs
 */
function reportArgumentsToCallback(callbackArgs) {

   return "\n" + callbackArgs.map( function( args, i ){

      var ancestors = args[2];
      
      return "Call number " + i + " was: \n" + 
               "\tnode:         " + JSON.stringify( args[0] ) + "\n" + 
               "\tpath:         " + JSON.stringify( args[1] ) + "\n" +
               "\tparent:       " + JSON.stringify( lastOf(ancestors) ) + "\n" +
               "\tgrandparent:  " + JSON.stringify( penultimateOf(ancestors) ) + "\n" +
               "\tancestors:    " + JSON.stringify( ancestors );
   
   }).join("\n\n");
         
}

// higher-level function to create assertions which will be used by the asserter.
function matched(obj) {

   return {   
      testAgainst: function assertMatchedRightObject( callbackStub ) {
      
         if(!callbackStub.calledWith(obj)) {

            var objectPassedToCall = function(callArgs){return callArgs[0]};
            
            fail( "was not called with the object " +  JSON.stringify(obj) + "\n" +
                "objects that I got are:" +
                JSON.stringify(callbackStub.args.map(objectPassedToCall) ) + "\n" +
                "all calls were with:" +
                reportArgumentsToCallback(callbackStub.args));
   
         }
      }
   
   ,  atPath: function assertAtRightPath(path) {
         var oldAssertion = this.testAgainst;
         
         this.testAgainst = function( callbackStub ){
            oldAssertion.apply(this, arguments);
            
            if(!callbackStub.calledWithMatch(sinon.match.any, path)) {
               fail( "was not called with the path " +  JSON.stringify(path) + "\n" +
                   "paths that I have are:\n" +
                   callbackStub.args.map(function(callArgs){
                     return "\t" + JSON.stringify(callArgs[1]) + "\n";
                   }) + "\n" +
                   "all calls were with:" +
                   reportArgumentsToCallback(callbackStub.args));
            }            
         };
         
         return this;   
      }
      
   ,  withParent: function( expectedParent ) {
         var oldAssertion = this.testAgainst;
         
         this.testAgainst = function( callbackStub ){
            oldAssertion.apply(this, arguments);
            
            var parentMatcher = sinon.match(function (array) {
               try{
                  var foundParent = penultimateOf(array);                    
                  assertEquals( expectedParent, foundParent );
               } catch(_e){
                  return false;
               }
               return true;
            }, "had the right parent");
            
            if(!callbackStub.calledWithMatch(obj, sinon.match.any, parentMatcher)) {
               fail( "was not called with the object" + JSON.stringify(obj) + 
                        " and parent object " +  JSON.stringify(expectedParent) +
                        "all calls were with:" +
                        reportArgumentsToCallback(callbackStub.args));
            }            
         };
         
         return this;
      }
      
   ,  withGrandparent: function( expectedGrandparent ) {
         var oldAssertion = this.testAgainst;
         
         this.testAgainst = function( callbackStub ){
            oldAssertion.apply(this, arguments);
            
            var grandparentMatcher = sinon.match(function (array) {
               try{
                  var foundGrandparent = prepenultimateOf(array);                
                  assertEquals( expectedGrandparent, foundGrandparent );
               } catch(_e){
                  return false;
               }
               return true;
            }, "had the right grandparent");
            
            if(!callbackStub.calledWithMatch(obj, sinon.match.any, grandparentMatcher)) {
               fail( "was not called with the object" + JSON.stringify(obj) + 
                        " and garndparent object " +  JSON.stringify(expectedGrandparent) +
                        "all calls were with:" +
                        reportArgumentsToCallback(callbackStub.args));
            }            
         };
         
         return this;
      }                  
      
   ,  atRootOfJson: function assertAtRootOfJson() {
         this.atPath([]);
         return this;
      }
   };
}