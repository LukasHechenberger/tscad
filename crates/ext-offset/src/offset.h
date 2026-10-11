#pragma once
#include <memory>
#include <vector>

#include <TopoDS_Edge.hxx>

// The same alias cadrum's bridge declares, so cxx treats both as one type.
namespace cadrum {
using TopoDS_Edge = ::TopoDS_Edge;
}

namespace tscad {

using cadrum::TopoDS_Edge;

/// Edges of one closed profile, collected from Rust.
struct EdgeList {
	std::vector<TopoDS_Edge> edges;
};

/// Closed loops of edges, each in wire order.
struct OffsetResult {
	std::vector<std::vector<TopoDS_Edge>> loops;
};

std::unique_ptr<EdgeList> edge_list_new();
void edge_list_push(EdgeList& list, const TopoDS_Edge& edge);

/// Offsets one closed planar profile; positive grows it. `round` joins corners with arcs
/// (OpenSCAD `r`), otherwise extends the sides until they meet (OpenSCAD `delta`).
std::unique_ptr<OffsetResult> offset_profile(const EdgeList& list, double distance, bool round);
size_t offset_loop_count(const OffsetResult& result);
size_t offset_loop_len(const OffsetResult& result, size_t loop);
std::unique_ptr<TopoDS_Edge> offset_edge(const OffsetResult& result, size_t loop, size_t index);

}  // namespace tscad
