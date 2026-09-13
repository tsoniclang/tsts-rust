export const sharedCases = Object.freeze({
  scalar: {
    owner: "tsts",
    directory: "test/scalar/source",
    importPath: "example.test/scalar",
    calls: ["Increment(10)"],
    expected: "11\n",
  },
  "array-storage": {
    owner: "gotots",
    directory: "testdata/constructs/value/arraystorage",
    importPath: "example.com/arraystorage",
    calls: [
      "Direct()", "Replacement()", "Nested()", "Empty()", "Allocated()", "Named()",
      "RecordReplacement()", "ElementReplacement()", "AnonymousReplacement()", "Overlap()",
      "Parallel()", "GlobalReplacement()", "NilCancellation()", "GenericReplacement()",
      "GenericElementReplacement()", "MapReplacement()", "DuplicateElementAddress()",
      "GenericRecordReplacement()", "GenericFieldReplacement()", "GenericScalarReplacement()",
      "OrderedReplacement()",
    ],
    expected: "true\n556\ntrue\ntrue\ntrue\n34\n4456\n65\n34\n112\n31\n34\ntrue\n34\n56\n14\ntrue\n456\n34\n2\n1234\n",
  },
  "memory-views": {
    owner: "gotots",
    directory: "testdata/constructs/value/memoryviews",
    importPath: "example.com/memoryviews",
    calls: [
      "ByteString()", "EmptyString()", "RetainedStringLocation()", "EmptyPointerView()",
      "StringBeyondSliceLength()", "SliceBackingAlias()", "NamedBacking()", "OrderedBacking()",
      "InvalidAddress()", "EmptyElementView()",
    ],
    expected: "true\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue\n",
  },
});
