package rustpointer

import "testing"

func TestPointers(tester *testing.T) {
	pointer := Allocate()
	if pointer == nil || *pointer != 0 || !Aliases() || !Distinct() {
		tester.Fatal("pointer allocation or identity differs from its contract")
	}
	*pointer = 42
	if *pointer != 42 {
		tester.Fatal("pointer mutation differs from its contract")
	}
}
