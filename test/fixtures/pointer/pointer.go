package rustpointer

func Allocate() *int32 {
	return new(int32)
}

func Aliases() bool {
	first := new(int32)
	second := first
	return first == second
}

func Distinct() bool {
	return new(int32) != new(int32)
}
