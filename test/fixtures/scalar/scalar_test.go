package rustproof

import "testing"

func TestAnswer(tester *testing.T) {
	if Answer() != 42 {
		tester.Fatal("scalar result differs from 42")
	}
}
