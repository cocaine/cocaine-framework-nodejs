
exports.makeError = function(category, code, descr, stack) {
  var e = new Error(descr)
  e.category = category
  e.code = code
  if(stack){
    e.stack = e.stack + stack
  }
}

