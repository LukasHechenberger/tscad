#include "tscad-ext-offset/src/offset.h"

#include <stdexcept>
#include <string>

#include <BRepBuilderAPI_MakeEdge.hxx>
#include <BRepBuilderAPI_MakeFace.hxx>
#include <BRepBuilderAPI_MakeWire.hxx>
#include <BRepOffsetAPI_MakeOffset.hxx>
#include <BRepLib.hxx>
#include <BRepTools_WireExplorer.hxx>
#include <BRep_Tool.hxx>
#include <Geom_Curve.hxx>
#include <Standard_Failure.hxx>
#include <TopExp_Explorer.hxx>
#include <TopoDS.hxx>

namespace tscad {

/// An edge whose curve runs in the edge's direction of travel. cadrum reads start/end points
/// from the curve's parameter range and ignores TopAbs_REVERSED, which OCCT's offset uses for
/// some corner arcs; such edges are rebuilt on the reversed curve.
static TopoDS_Edge forward(const TopoDS_Edge& edge) {
	if (edge.Orientation() != TopAbs_REVERSED) return edge;
	TopoDS_Edge copy = edge;
	BRepLib::BuildCurves3d(copy);  // offset edges may only carry curves on the plane
	double first = 0, last = 0;
	Handle(Geom_Curve) curve = BRep_Tool::Curve(copy, first, last);
	if (curve.IsNull()) throw std::runtime_error("offset produced an edge without a 3D curve");
	Handle(Geom_Curve) reversed = curve->Reversed();
	BRepBuilderAPI_MakeEdge rebuilt(reversed, reversed->ReversedParameter(last), reversed->ReversedParameter(first));
	if (!rebuilt.IsDone()) throw std::runtime_error("could not re-orient an offset edge");
	return rebuilt.Edge();
}

std::unique_ptr<EdgeList> edge_list_new() { return std::make_unique<EdgeList>(); }

void edge_list_push(EdgeList& list, const TopoDS_Edge& edge) { list.edges.push_back(edge); }

std::unique_ptr<OffsetResult> offset_profile(const EdgeList& list, double distance, bool round) {
	// cxx turns std::exception into Rust errors (Standard_Failure is one since OCCT 8); caught
	// here to say where the message comes from.
	try {
		BRepBuilderAPI_MakeWire wire;
		for (const auto& edge : list.edges) wire.Add(edge);
		if (!wire.IsDone()) throw std::runtime_error("the profile's edges do not form a connected wire");

		// Offsetting a face (not a bare wire) makes the sign independent of the wire's direction:
		// positive always grows the region.
		BRepBuilderAPI_MakeFace face(wire.Wire(), /* OnlyPlane */ true);
		if (!face.IsDone()) throw std::runtime_error("the profile is not a closed planar loop");

		BRepOffsetAPI_MakeOffset offset(face.Face(), round ? GeomAbs_Arc : GeomAbs_Intersection);
		offset.Perform(distance);
		if (!offset.IsDone()) throw std::runtime_error("OCCT could not offset this profile");

		auto result = std::make_unique<OffsetResult>();
		for (TopExp_Explorer wires(offset.Shape(), TopAbs_WIRE); wires.More(); wires.Next()) {
			std::vector<TopoDS_Edge> loop;
			for (BRepTools_WireExplorer edges(TopoDS::Wire(wires.Current())); edges.More(); edges.Next()) loop.push_back(forward(edges.Current()));
			if (!loop.empty()) result->loops.push_back(std::move(loop));
		}
		return result;
	} catch (const Standard_Failure& failure) {
		throw std::runtime_error(std::string("OCCT: ") + failure.what());
	}
}

size_t offset_loop_count(const OffsetResult& result) { return result.loops.size(); }

size_t offset_loop_len(const OffsetResult& result, size_t loop) { return result.loops.at(loop).size(); }

std::unique_ptr<TopoDS_Edge> offset_edge(const OffsetResult& result, size_t loop, size_t index) {
	return std::make_unique<TopoDS_Edge>(result.loops.at(loop).at(index));
}

}  // namespace tscad
