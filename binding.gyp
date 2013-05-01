{
  'targets': [
    {
      'target_name': 'nodejs_cocaine_framework',
      'sources': [ 'src/node_addon.cpp',
                   'src/worker.cpp'
      ],
      'CXX': '/usr/bin/clang',
      'libraries': [ '-lboost_program_options-mt',
                     '-lmsgpack',
                     '-lboost_thread-mt'
      ],
      'ldflags':['-Wl,-Bsymbolic-functions','-rdynamic'],
      'cflags': ['-std=c++0x','-g','-O0','-Wno-invalid-offsetof'],
      'cflags!': ['-O2'],
      'include_dirs': [
         './include'
      ],
      'cflags_cc!':['-fno-rtti','-fno-exceptions']
    }
  ]
}

