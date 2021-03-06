

(function(){


   TestCase("functionalTest", {

      'testVarargsWithSomeFixedArgs': function() {
      
         var received1, received2, received3;
      
         function f(r1, r2, r3){
            received1 = r1;
            received2 = r2;
            received3 = r3;
         }
      
         var varargsSpy = varArgs(f);
         
         varargsSpy('a', 'b', 'c', 'd', 'e', 'f');
         
         assertEquals('a', received1);
         assertEquals('b', received2);
         assertEquals(['c', 'd', 'e', 'f'], received3);
      }
      
   ,  'testVarargsWithNoFixedArgs': function() {
      
         var received1 = 'not yet set';
      
         function f(r1){
            received1 = r1;
         }
      
         var varargsSpy = varArgs(f);
         
         varargsSpy('a', 'b', 'c', 'd', 'e', 'f');
         
         assertEquals(['a', 'b', 'c', 'd', 'e', 'f'], received1);
      }
      
           
   ,  'testVarargsGivesReturnValueBack': function() {
            
         var varargsTestFn = varArgs(function(){ return 'expected' });
                  
         assertEquals('expected', varargsTestFn());
      }
                          
   ,  'testCompose': function() {
         function dub(n){ return n*2 }
         function inc(n){ return n+1 }
         function half(n){ return n/2 }
         
         var composed = compose(dub, inc, half);  // composed(x) = dub(inc(half(x)))
         
         assertEquals( 4 , composed(2)); // if this gives 2.5 the order is wrong
      }
      
   ,  'testCompositionOfAList': function() {
         var list = cons( {a:1}, emptyList );
   
         assertEquals(1, compose(attr('a'), head)( list ));
      }      
      
   ,  'testComposeWithZeroFunctions': function() {
         
         var id = compose();
         
         assertEquals( 2 , id(2));
      }                                          
   
   });

})();