{
  'targets': [
    {
      'target_name': 'cocaine',
      'sources': [ 'src/worker.cpp', 'src/stream.cpp', 'src/common.cpp'],
      'libraries': ['-lcocaine-core -lboost_program_options-mt'],
      'ldflags':['-Wl,-Bsymbolic-functions','-rdynamic'],
      'cflags': ['-std=c++0x','-g','-O0'],
      'cflags!': ['-O2'],
      'cflags_cc!':['-fno-rtti','-fno-exceptions']
    }
  ]
}

