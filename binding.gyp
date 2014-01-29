{
    'targets': [{
        'target_name': 'nodejs_cocaine_framework',
        'sources': ['src/node_addon.cpp',
            'src/worker.cpp'
        ],
        'libraries': [
            '-lmsgpack',
            '-lboost_system'
        ],
        'ldflags': ['-Wl,-Bsymbolic-functions', '-rdynamic'],
        'cflags': ['-std=c++0x', '-g', '-O0', '-Wno-invalid-offsetof'],
        'cflags!': ['-O2', '-fno-exceptions'],
        'include_dirs': [
            './include'
        ],
        'cflags_cc!': ['-fno-rtti'],
        'conditions': [
            ['OS=="mac"', {
                'xcode_settings': {
                    'OTHER_CPLUSPLUSFLAGS': ['-stdlib=libc++', '-std=c++0x', '-mmacosx-version-min=10.7'],
                    'GCC_ENABLE_CPP_EXCEPTIONS': 'true'
                },
            }],
        ],
    }]
}