use cadrum::{Edge, Solid};

/// A region in the XY plane: closed loops of edges, one after another. The first loop is the
/// outline, any further loops are holes in it (cadrum's extrude and revolve read it that way).
pub type Profile = Vec<Edge>;

/// The number of closed loops in `profile` (1 unless it has holes).
pub fn loop_count(profile: &[Edge]) -> usize {
	let tolerance = Edge::precision_distance();
	let mut count = 0;
	let mut start = None;
	for edge in profile {
		let first = *start.get_or_insert(edge.start_point());
		if edge.end_point().distance(first) <= tolerance {
			count += 1;
			start = None;
		}
	}
	count
}

/// What a node evaluates to: solids (3D) or profiles (2D). Like in OpenSCAD, a node may yield
/// several disjoint pieces.
#[derive(Clone)]
pub enum Geometry {
	Solids(Vec<Solid>),
	Profiles(Vec<Profile>),
}

impl Geometry {
	pub fn is_empty(&self) -> bool {
		match self {
			Geometry::Solids(solids) => solids.is_empty(),
			Geometry::Profiles(profiles) => profiles.is_empty(),
		}
	}
}
