
module.exports = {
  Q: function(Q){
    return {
      defer: function(){
        return Q.defer()
      },
      fulfill: function(deferred, result){
        return deferred.resolve(result)
      },
      reject: function(deferred, error){
        return deferred.reject(error)
      },
      promise: function(deferred){
        return deferred.promise
      }
    }
  },

  Vow: function(Vow){
    return {
      defer: function(){
        return Vow.promise()
      },
      fulfill: function(deferred, result){
        return deferred.fullfill(result)
      },
      reject: function(deferred, error){
        return deferred.reject(error)
      },
      promise: function(deferred){
        return deferred
      }
    }
  }
  
}


