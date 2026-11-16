/**
 * The 396 column headers of a Data Axle Reference Solutions detailed business export, in
 * export order, copied from the "Header Inventory" sheet of
 * docs/translator/JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx (column "Exact Source Header").
 * Headers only: that workbook has no data rows, and neither does this file.
 *
 * Spacing is exact: "Advertising  Expenses" has two spaces. Position 396 has no header in real
 * exports, so the last entry is null.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export const RS_HEADERS: readonly (string | null)[] = [
  "Company Name", // 1
  "Parent Company Name", // 2
  "Executive First Name", // 3
  "Executive Last Name", // 4
  "Professional Title", // 5
  "Executive Title", // 6
  "Executive Gender", // 7
  "Address", // 8
  "City", // 9
  "State", // 10
  "ZIP Code", // 11
  "ZIP Four", // 12
  "Carrier Route", // 13
  "Delivery Point Barcode", // 14
  "County", // 15
  "Metro Area", // 16
  "Neighborhood", // 17
  "Phone Number Combined", // 18
  "Fax Number Combined", // 19
  "Toll Free Number Combined", // 20
  "Website", // 21
  "Company Description", // 22
  "Primary SIC Code", // 23
  "Primary SIC Description", // 24
  "Primary SIC Ad Size", // 25
  "Primary SIC Year Appeared", // 26
  "SIC Code 1", // 27
  "SIC Code 1 Description", // 28
  "SIC Code 1 Ad Size", // 29
  "SIC Code 1 Year Appeared", // 30
  "SIC Code 2", // 31
  "SIC Code 2 Description", // 32
  "SIC Code 2 Ad Size", // 33
  "SIC Code 2 Year Appeared", // 34
  "SIC Code 3", // 35
  "SIC Code 3 Description", // 36
  "SIC Code 3 Ad Size", // 37
  "SIC Code 3 Year Appeared", // 38
  "SIC Code 4", // 39
  "SIC Code 4 Description", // 40
  "SIC Code 4 Ad Size", // 41
  "SIC Code 4 Year Appeared", // 42
  "SIC Code 5", // 43
  "SIC Code 5 Description", // 44
  "SIC Code 5 Ad Size", // 45
  "SIC Code 5 Year Appeared", // 46
  "SIC Code 6", // 47
  "SIC Code 6 Description", // 48
  "SIC Code 6 Ad Size", // 49
  "SIC Code 6 Year Appeared", // 50
  "SIC Code 7", // 51
  "SIC Code 7 Description", // 52
  "SIC Code 7 Ad Size", // 53
  "SIC Code 7 Year Appeared", // 54
  "SIC Code 8", // 55
  "SIC Code 8 Description", // 56
  "SIC Code 8 Ad Size", // 57
  "SIC Code 8 Year Appeared", // 58
  "SIC Code 9", // 59
  "SIC Code 9 Description", // 60
  "SIC Code 9 Ad Size", // 61
  "SIC Code 9 Year Appeared", // 62
  "SIC Code 10", // 63
  "SIC Code 10 Description", // 64
  "SIC Code 10 Ad Size", // 65
  "SIC Code 10 Year Appeared", // 66
  "Primary NAICS", // 67
  "Primary NAICS Description", // 68
  "NAICS 1", // 69
  "NAICS 1 Description", // 70
  "NAICS 2", // 71
  "NAICS 2 Description", // 72
  "NAICS 3", // 73
  "NAICS 3 Description", // 74
  "NAICS 4", // 75
  "NAICS 4 Description", // 76
  "NAICS 5", // 77
  "NAICS 5 Description", // 78
  "NAICS 6", // 79
  "NAICS 6 Description", // 80
  "NAICS 7", // 81
  "NAICS 7 Description", // 82
  "NAICS 8", // 83
  "NAICS 8 Description", // 84
  "NAICS 9", // 85
  "NAICS 9 Description", // 86
  "NAICS 10", // 87
  "NAICS 10 Description", // 88
  "Franchise Description 1", // 89
  "Franchise Description 2", // 90
  "Franchise Description 3", // 91
  "Franchise Description 4", // 92
  "Franchise Description 5", // 93
  "Cuisine Code", // 94
  "Cuisine Code Description", // 95
  "Location Employee Size Range", // 96
  "Location Employee Size Actual", // 97
  "Location Sales Volume Range", // 98
  "Location Sales Volume Actual", // 99
  "Corporate Employee Size Range", // 100
  "Corporate Employee Size Actual", // 101
  "Corporate Sales Volume Range", // 102
  "Corporate Sales Volume Actual", // 103
  "Type of Business", // 104
  "Location Type", // 105
  "IUSA Number", // 106
  "Parent IUSA Number", // 107
  "Subsidiary IUSA Number", // 108
  "Foreign Parent Flag", // 109
  "EIN 1", // 110
  "EIN 2", // 111
  "EIN 3", // 112
  "Fortune 1000 Ranking", // 113
  "Credit Cards Accepted", // 114
  "Last Updated On", // 115
  "Years In Database", // 116
  "Year Established", // 117
  "Square Footage", // 118
  "Home Business", // 119
  "Credit Score Alpha", // 120
  "Government Office", // 121
  "Import Export Flag", // 122
  "Own or Lease", // 123
  "Firm or Individual", // 124
  "Monday Open", // 125
  "Monday Close", // 126
  "Tuesday Open", // 127
  "Tuesday Close", // 128
  "Wednesday Open", // 129
  "Wednesday Close", // 130
  "Thursday Open", // 131
  "Thursday Close", // 132
  "Friday Open", // 133
  "Friday Close", // 134
  "Saturday Open", // 135
  "Saturday Close", // 136
  "Sunday Open", // 137
  "Sunday Close", // 138
  "Executive First Name 1", // 139
  "Executive Last Name 1", // 140
  "Executive Title 1", // 141
  "Executive Gender 1", // 142
  "Executive First Name 2", // 143
  "Executive Last Name 2", // 144
  "Executive Title 2", // 145
  "Executive Gender 2", // 146
  "Executive First Name 3", // 147
  "Executive Last Name 3", // 148
  "Executive Title 3", // 149
  "Executive Gender 3", // 150
  "Executive First Name 4", // 151
  "Executive Last Name 4", // 152
  "Executive Title 4", // 153
  "Executive Gender 4", // 154
  "Executive First Name 5", // 155
  "Executive Last Name 5", // 156
  "Executive Title 5", // 157
  "Executive Gender 5", // 158
  "Executive First Name 6", // 159
  "Executive Last Name 6", // 160
  "Executive Title 6", // 161
  "Executive Gender 6", // 162
  "Executive First Name 7", // 163
  "Executive Last Name 7", // 164
  "Executive Title 7", // 165
  "Executive Gender 7", // 166
  "Executive First Name 8", // 167
  "Executive Last Name 8", // 168
  "Executive Title 8", // 169
  "Executive Gender 8", // 170
  "Executive First Name 9", // 171
  "Executive Last Name 9", // 172
  "Executive Title 9", // 173
  "Executive Gender 9", // 174
  "Executive First Name 10", // 175
  "Executive Last Name 10", // 176
  "Executive Title 10", // 177
  "Executive Gender 10", // 178
  "Executive First Name 11", // 179
  "Executive Last Name 11", // 180
  "Executive Title 11", // 181
  "Executive Gender 11", // 182
  "Executive First Name 12", // 183
  "Executive Last Name 12", // 184
  "Executive Title 12", // 185
  "Executive Gender 12", // 186
  "Executive First Name 13", // 187
  "Executive Last Name 13", // 188
  "Executive Title 13", // 189
  "Executive Gender 13", // 190
  "Executive First Name 14", // 191
  "Executive Last Name 14", // 192
  "Executive Title 14", // 193
  "Executive Gender 14", // 194
  "Executive First Name 15", // 195
  "Executive Last Name 15", // 196
  "Executive Title 15", // 197
  "Executive Gender 15", // 198
  "Executive First Name 16", // 199
  "Executive Last Name 16", // 200
  "Executive Title 16", // 201
  "Executive Gender 16", // 202
  "Executive First Name 17", // 203
  "Executive Last Name 17", // 204
  "Executive Title 17", // 205
  "Executive Gender 17", // 206
  "Executive First Name 18", // 207
  "Executive Last Name 18", // 208
  "Executive Title 18", // 209
  "Executive Gender 18", // 210
  "Executive First Name 19", // 211
  "Executive Last Name 19", // 212
  "Executive Title 19", // 213
  "Executive Gender 19", // 214
  "Executive First Name 20", // 215
  "Executive Last Name 20", // 216
  "Executive Title 20", // 217
  "Executive Gender 20", // 218
  "Executive First Name 21", // 219
  "Executive Last Name 21", // 220
  "Executive Title 21", // 221
  "Executive Gender 21", // 222
  "Executive First Name 22", // 223
  "Executive Last Name 22", // 224
  "Executive Title 22", // 225
  "Executive Gender 22", // 226
  "Executive First Name 23", // 227
  "Executive Last Name 23", // 228
  "Executive Title 23", // 229
  "Executive Gender 23", // 230
  "Executive First Name 24", // 231
  "Executive Last Name 24", // 232
  "Executive Title 24", // 233
  "Executive Gender 24", // 234
  "Executive First Name 25", // 235
  "Executive Last Name 25", // 236
  "Executive Title 25", // 237
  "Executive Gender 25", // 238
  "Executive First Name 26", // 239
  "Executive Last Name 26", // 240
  "Executive Title 26", // 241
  "Executive Gender 26", // 242
  "Executive First Name 27", // 243
  "Executive Last Name 27", // 244
  "Executive Title 27", // 245
  "Executive Gender 27", // 246
  "Executive First Name 28", // 247
  "Executive Last Name 28", // 248
  "Executive Title 28", // 249
  "Executive Gender 28", // 250
  "Executive First Name 29", // 251
  "Executive Last Name 29", // 252
  "Executive Title 29", // 253
  "Executive Gender 29", // 254
  "Executive First Name 30", // 255
  "Executive Last Name 30", // 256
  "Executive Title 30", // 257
  "Executive Gender 30", // 258
  "Executive First Name 31", // 259
  "Executive Last Name 31", // 260
  "Executive Title 31", // 261
  "Executive Gender 31", // 262
  "Executive First Name 32", // 263
  "Executive Last Name 32", // 264
  "Executive Title 32", // 265
  "Executive Gender 32", // 266
  "Executive First Name 33", // 267
  "Executive Last Name 33", // 268
  "Executive Title 33", // 269
  "Executive Gender 33", // 270
  "Executive First Name 34", // 271
  "Executive Last Name 34", // 272
  "Executive Title 34", // 273
  "Executive Gender 34", // 274
  "Executive First Name 35", // 275
  "Executive Last Name 35", // 276
  "Executive Title 35", // 277
  "Executive Gender 35", // 278
  "Executive First Name 36", // 279
  "Executive Last Name 36", // 280
  "Executive Title 36", // 281
  "Executive Gender 36", // 282
  "Executive First Name 37", // 283
  "Executive Last Name 37", // 284
  "Executive Title 37", // 285
  "Executive Gender 37", // 286
  "Executive First Name 38", // 287
  "Executive Last Name 38", // 288
  "Executive Title 38", // 289
  "Executive Gender 38", // 290
  "Executive First Name 39", // 291
  "Executive Last Name 39", // 292
  "Executive Title 39", // 293
  "Executive Gender 39", // 294
  "Executive First Name 40", // 295
  "Executive Last Name 40", // 296
  "Executive Title 40", // 297
  "Executive Gender 40", // 298
  "Executive First Name 41", // 299
  "Executive Last Name 41", // 300
  "Executive Title 41", // 301
  "Executive Gender 41", // 302
  "Executive First Name 42", // 303
  "Executive Last Name 42", // 304
  "Executive Title 42", // 305
  "Executive Gender 42", // 306
  "Executive First Name 43", // 307
  "Executive Last Name 43", // 308
  "Executive Title 43", // 309
  "Executive Gender 43", // 310
  "Executive First Name 44", // 311
  "Executive Last Name 44", // 312
  "Executive Title 44", // 313
  "Executive Gender 44", // 314
  "Executive First Name 45", // 315
  "Executive Last Name 45", // 316
  "Executive Title 45", // 317
  "Executive Gender 45", // 318
  "Executive First Name 46", // 319
  "Executive Last Name 46", // 320
  "Executive Title 46", // 321
  "Executive Gender 46", // 322
  "Executive First Name 47", // 323
  "Executive Last Name 47", // 324
  "Executive Title 47", // 325
  "Executive Gender 47", // 326
  "Executive First Name 48", // 327
  "Executive Last Name 48", // 328
  "Executive Title 48", // 329
  "Executive Gender 48", // 330
  "Executive First Name 49", // 331
  "Executive Last Name 49", // 332
  "Executive Title 49", // 333
  "Executive Gender 49", // 334
  "Executive First Name 50", // 335
  "Executive Last Name 50", // 336
  "Executive Title 50", // 337
  "Executive Gender 50", // 338
  "Ticker Symbol", // 339
  "Stock Exchange", // 340
  "Accounting Expenses", // 341
  "Advertising  Expenses", // 342
  "Computer Expenses", // 343
  "Contract Labor Expenses", // 344
  "Insurance Expenses", // 345
  "Legal Expenses", // 346
  "Office Supplies Expense", // 347
  "Management/Administration Expenses", // 348
  "Package Container Expense", // 349
  "Payroll and Benefits Expenses", // 350
  "Purchase Print Expenses", // 351
  "Rent Expenses", // 352
  "Telcom Expenses", // 353
  "Utilities Expenses", // 354
  "Mailing Address", // 355
  "Mailing City", // 356
  "Mailing State", // 357
  "Mailing Zip Code", // 358
  "Mailing Zip Four", // 359
  "Mailing Carrier Route", // 360
  "Mailing Delivery Point Bar Code", // 361
  "Twitter", // 362
  "Linked-In", // 363
  "Facebook", // 364
  "Franchise/Specialty Code 2.0", // 365
  "Franchise/Specialty Code 2.1", // 366
  "Franchise/Specialty Code 3.0", // 367
  "Franchise/Specialty Code 3.1", // 368
  "Franchise/Specialty Code 4.0", // 369
  "Franchise/Specialty Code 4.1", // 370
  "Franchise/Specialty Code 5.0", // 371
  "Franchise/Specialty Code 5.1", // 372
  "Franchise/Specialty Code 6.0", // 373
  "Affiliated Records", // 374
  "Franchise/Specialty Code 6.1", // 375
  "Affiliated Locations", // 376
  "Federal Contractor", // 377
  "Assessor's parcel number", // 378
  "Appraised Value", // 379
  "Accessed Value", // 380
  "Building Count", // 381
  "Building Square Footage", // 382
  "Land Square Footage", // 383
  "Last Assessment Year", // 384
  "Market Value", // 385
  "Original Construction Year", // 386
  "Owns Location", // 387
  "Property Owner", // 388
  "Recorded Sale Date", // 389
  "Sale Price", // 390
  "Seller Name", // 391
  "Veteran Exemption", // 392
  "Census Block Group", // 393
  "Legal Name", // 394
  "Record Type", // 395
  null, // 396
];
