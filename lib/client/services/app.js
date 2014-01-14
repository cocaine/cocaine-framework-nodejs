

module.exports = function(methods){
  return {
    defaultMethod: methods.streaming,
    methods:{
      info: methods.unpacking
    }
  }  
}


