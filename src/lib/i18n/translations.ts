export type Lang = 'en' | 'id' | 'ru';

export const translations = {
  // ── Login ──────────────────────────────────────────────────────
  'login.subtitle':   { en: 'Sign in to your account',             id: 'Masuk ke akun kamu',             ru: 'Войдите в аккаунт'                     },
  'login.btn':        { en: 'Sign In',                             id: 'Masuk',                           ru: 'Войти'                                 },
  'login.loading':    { en: 'Signing in…',                         id: 'Masuk…',                          ru: 'Вход…'                                 },
  'login.error':      { en: 'Invalid email or password. Please try again.', id: 'Email atau password salah. Coba lagi.', ru: 'Неверный email или пароль. Попробуйте ещё раз.' },
  'login.noAccount':  { en: "Don't have an account?",              id: 'Belum punya akun?',              ru: 'Нет аккаунта?'                         },
  'login.createLink': { en: 'Create one here',                     id: 'Daftar di sini',                  ru: 'Создать здесь'                         },

  // ── Register ───────────────────────────────────────────────────
  'reg.subtitle':           { en: 'Create your free account',            id: 'Buat akun baru',                    ru: 'Создать аккаунт'                       },
  'reg.fullName':           { en: 'Full Name',                           id: 'Nama',                              ru: 'Полное имя'                            },
  'reg.namePlaceholder':    { en: 'Your full name',                      id: 'Nama lengkap kamu',                 ru: 'Ваше полное имя'                       },
  'reg.passPlaceholder':    { en: 'Minimum 8 characters',                id: 'Minimal 8 karakter',                ru: 'Минимум 8 символов'                    },
  'reg.confirmPass':        { en: 'Confirm Password',                    id: 'Konfirmasi Password',               ru: 'Подтвердите пароль'                    },
  'reg.confirmPlaceholder': { en: 'Repeat your password',                id: 'Ulangi password',                   ru: 'Повторите пароль'                      },
  'reg.errShort':           { en: 'Password must be at least 8 characters.', id: 'Password minimal 8 karakter.',  ru: 'Пароль должен содержать минимум 8 символов.' },
  'reg.errMismatch':        { en: 'Passwords do not match. Please try again.', id: 'Password tidak cocok. Coba lagi.', ru: 'Пароли не совпадают. Попробуйте ещё раз.' },
  'reg.errFailed':          { en: 'Registration failed. Please try again.', id: 'Gagal mendaftar. Coba lagi.',     ru: 'Ошибка регистрации. Попробуйте ещё раз.' },
  'reg.loading':            { en: 'Creating account…',                   id: 'Mendaftar…',                        ru: 'Создание аккаунта…'                    },
  'reg.btn':                { en: 'Create Account',                      id: 'Daftar',                            ru: 'Создать аккаунт'                       },
  'reg.hasAccount':         { en: 'Already have an account?',            id: 'Sudah punya akun?',                 ru: 'Уже есть аккаунт?'                     },
  'reg.signInLink':         { en: 'Sign in here',                        id: 'Masuk di sini',                     ru: 'Войти здесь'                           },

  // ── Dashboard nav ──────────────────────────────────────────────
  'nav.enrichAll':    { en: '🔍 Enrich All',    id: '🔍 Enrich Semua',   ru: '🔍 Обогатить всё'  },
  'nav.scoreAll':     { en: '📊 Score All',     id: '📊 Nilai Semua',    ru: '📊 Оценить всё'    },
  'nav.exportCsv':    { en: '↓ Export CSV',     id: '↓ Ekspor CSV',      ru: '↓ Экспорт CSV'     },
  'nav.clearAll':     { en: '🗑 Clear All',      id: '🗑 Hapus Semua',    ru: '🗑 Очистить всё'   },
  'nav.logout':       { en: 'Logout',            id: 'Keluar',            ru: 'Выйти'             },
  'nav.niche':        { en: 'Outreach niche:',   id: 'Niche outreach:',   ru: 'Ниша:'             },

  // ── Search panel ───────────────────────────────────────────────
  'search.title':     { en: 'Source Local Businesses',   id: 'Cari Bisnis Lokal',         ru: 'Поиск местных бизнесов'  },
  'search.fromGmaps': { en: 'from Google Maps',          id: 'dari Google Maps',           ru: 'из Google Maps'         },
  'search.keyword':   { en: 'Keyword  (e.g. dentist, spa, lawyer)',  id: 'Kata kunci  (mis. dokter, spa, pengacara)',  ru: 'Ключевое слово  (напр. врач, спа, юрист)' },
  'search.location':  { en: 'Location  (e.g. Bali, Jakarta)',        id: 'Lokasi  (mis. Bali, Jakarta)',               ru: 'Местоположение  (напр. Москва, СПб)'     },
  'search.results':   { en: 'results',            id: 'hasil',             ru: 'результатов'       },
  'search.run':       { en: '▶  Run Search',      id: '▶  Cari',           ru: '▶  Найти'          },
  'search.running':   { en: 'Searching…',          id: 'Mencari…',          ru: 'Поиск…'            },

  // ── Drawer sections ────────────────────────────────────────────
  'drawer.pipeline':      { en: 'Pipeline Progress',  id: 'Progress Pipeline',  ru: 'Прогресс'         },
  'drawer.detectedEmails':{ en: 'Detected Emails',    id: 'Email Terdeteksi',   ru: 'Найденные email'  },
  'drawer.actions':       { en: 'Actions',             id: 'Aksi',               ru: 'Действия'         },
  'drawer.businessInfo':  { en: 'Business Info',       id: 'Info Bisnis',        ru: 'О компании'       },
  'drawer.leadScore':     { en: 'Lead Score',          id: 'Skor Lead',          ru: 'Оценка лида'      },
  'drawer.issuesFound':   { en: 'Issues Found',        id: 'Masalah Ditemukan',  ru: 'Найденные проблемы'},
  'drawer.websiteAnalysis':{ en: 'Website Analysis',  id: 'Analisis Website',   ru: 'Анализ сайта'     },
  'drawer.sendEmail':     { en: 'Send',                id: 'Kirim',              ru: 'Отправить'        },

  // ── Action buttons ─────────────────────────────────────────────
  'action.enrichSite':     { en: 'Enrich Site',          id: 'Enrich Situs',       ru: 'Обогатить сайт'    },
  'action.discoverSite':   { en: 'Discover Site',        id: 'Temukan Situs',      ru: 'Найти сайт'        },
  'action.scanning':       { en: 'Scanning…',            id: 'Memindai…',          ru: 'Сканирование…'     },
  'action.scoreLead':      { en: 'Score Lead',           id: 'Nilai Lead',         ru: 'Оценить лид'       },
  'action.scoring':        { en: 'Scoring…',             id: 'Menilai…',           ru: 'Оценка…'           },
  'action.genOutreach':    { en: 'Generate Outreach',    id: 'Buat Outreach',      ru: 'Создать письмо'    },
  'action.regenOutreach':  { en: 'Regenerate Outreach',  id: 'Buat Ulang Outreach',ru: 'Пересоздать письмо'},
  'action.generating':     { en: 'Generating…',          id: 'Membuat…',           ru: 'Создание…'         },
  'action.deleteLead':     { en: 'Delete Lead',          id: 'Hapus Lead',         ru: 'Удалить лид'       },

  // ── EmailDrawer ────────────────────────────────────────────────
  'email.header':    { en: 'Send Outreach Email',   id: 'Kirim Email Outreach',  ru: 'Отправить письмо'     },
  'email.to':        { en: 'To',                    id: 'Kirim ke',              ru: 'Кому'                 },
  'email.subject':   { en: 'Subject',               id: 'Subjek',                ru: 'Тема'                 },
  'email.body':      { en: 'Email Body',            id: 'Isi Email',             ru: 'Текст письма'         },
  'email.send':      { en: 'Send Email',            id: 'Kirim Email',           ru: 'Отправить'            },
  'email.sending':   { en: 'Sending…',              id: 'Mengirim…',             ru: 'Отправка…'            },
  'email.cancel':    { en: 'Cancel',                id: 'Batal',                 ru: 'Отмена'               },
  'email.sent':      { en: 'Email Sent!',           id: 'Email Terkirim!',       ru: 'Письмо отправлено!'   },
  'email.deliveredTo':{ en: 'Delivered to',         id: 'Berhasil ke',           ru: 'Доставлено:'          },
  'email.closing':   { en: 'Closing automatically…', id: 'Menutup otomatis…',   ru: 'Закрытие…'            },
  'email.chars':     { en: 'characters',            id: 'karakter',              ru: 'символов'             },
  'email.errEmpty':  { en: 'Please enter a recipient email address', id: 'Masukkan alamat email tujuan', ru: 'Введите email получателя' },
  'email.errSubject':{ en: 'Subject cannot be empty', id: 'Subject tidak boleh kosong', ru: 'Тема не может быть пустой' },
  'email.errBody':   { en: 'Email body cannot be empty', id: 'Isi email tidak boleh kosong', ru: 'Текст письма не может быть пустым' },
  'email.errFailed': { en: 'Failed to send email',  id: 'Gagal mengirim email',  ru: 'Ошибка отправки'      },
} as const;

export type TranslationKey = keyof typeof translations;
