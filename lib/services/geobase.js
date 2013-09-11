
var _ = require('../service')
var Service = _.Service
var method = _.method

var Geobase = 
  Service.def('geobase',{
    methods:{
      region_id: method.unpacking,
      chief_region_id: method.unpacking,
      children: method.unpacking,
      ip_in: method.unpacking,
      id_in: method.unpacking,
      parent_id: method.unpacking,
      parents: method.unpacking,
      region_id_by_location: method.unpacking,
      subtree: method.unpacking,
      supported_linguistics: method.unpacking,
      timezone_name: method.unpacking,
      timezone: method.unpacking,
      timezone_for_time: method.unpacking,
      linguistics_for_region: method.unpacking,
      get_services: method.unpacking,
      have_service: method.unpacking,
      set_service: method.unpacking,
      parent: method.unpacking,
      coordinates: method.unpacking,
      names: method.unpacking,
      codes: method.unpacking,
      region_data: method.unpacking,
      pinpoint_geolocation: method.unpacking,
      region_ids_by_name: method.unpacking
    }
  })

module.exports = Geobase 

